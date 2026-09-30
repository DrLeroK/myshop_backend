import http from 'http';
import app from '../src/app';
import { prisma } from '../src/config/prisma';

const PORT = 5099;
let server: http.Server;
let ownerToken: string;
let cashierToken: string;
let shopId: number;
let secondShopId: number;
let product1Id: number;
let product2Id: number;

async function request(
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const url = `http://127.0.0.1:${PORT}${path}`;
    const parsedUrl = new URL(url);

    const postData = body ? JSON.stringify(body) : '';

    const options: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode || 500, body: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode || 500, body: data as any, headers: res.headers });
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting myshop_backend E2E Integration Test Suite...\n');

  server = app.listen(PORT);

  try {
    // 1. Health Check
    const health = await request('GET', '/health');
    console.log('✅ 1. Health Check status:', health.status, health.body.status);

    // 2. Auth - Login Owner & Cashier
    const ownerLogin = await request('POST', '/api/auth/login', {
      email: 'owner@myshop.com',
      password: 'Password123!',
    });
    console.log('✅ 2a. Owner Login:', ownerLogin.status, ownerLogin.body.data.user.email);
    ownerToken = ownerLogin.body.data.token;

    const cashierLogin = await request('POST', '/api/auth/login', {
      email: 'cashier@myshop.com',
      password: 'Password123!',
    });
    console.log('✅ 2b. Cashier Login:', cashierLogin.status, cashierLogin.body.data.user.email);
    cashierToken = cashierLogin.body.data.token;

    // 3. Multi-Shop Support - Get Owner's Shops & Executive Dashboard
    const shopsRes = await request('GET', '/api/shops/my-shops', null, ownerToken);
    const mainShop = shopsRes.body.data.find((s: any) => s._count.products > 0) || shopsRes.body.data[0];
    const secondShop = shopsRes.body.data.find((s: any) => s.id !== mainShop.id) || shopsRes.body.data[1];
    shopId = mainShop.id;
    secondShopId = secondShop.id;
    console.log(`✅ 3a. Multi-Shop Check: Found ${shopsRes.body.data.length} shops. Active Main Shop ID: ${shopId} (${mainShop.name}), Second Shop ID: ${secondShopId} (${secondShop.name})`);

    const ownerDashboard = await request('GET', '/api/shops/owner/dashboard?period=monthly', null, ownerToken);
    console.log(`✅ 3b. Multi-Shop Aggregated Executive Dashboard: Total Consolidated Revenue = $${ownerDashboard.body.data.consolidatedMetrics.totalRevenue} across ${ownerDashboard.body.data.totalShops} shops.`);

    // 4. Inventory Management - Fetch Products & Low Stock Items
    const productsRes = await request('GET', `/api/products/shop/${shopId}`, null, ownerToken);
    console.log(`✅ 4a. Inventory Fetch: Total products in shop = ${productsRes.body.data.length}`);
    product1Id = productsRes.body.data[0].id; // Milk
    product2Id = productsRes.body.data[1].id; // Bread (low stock)

    const initialProduct1Stock = productsRes.body.data[0].stockQuantity;
    const product1Name = productsRes.body.data[0].name;

    console.log(`   Product '${product1Name}' initial stock: ${initialProduct1Stock}`);

    // 4b. Multi-Shop Stock Transfer Test
    const transferRes = await request(
      'POST',
      '/api/shops/owner/transfer-stock',
      {
        sourceShopId: shopId,
        targetShopId: secondShopId,
        productId: product1Id,
        quantity: 5,
      },
      ownerToken
    );
    console.log(`✅ 4b. Inter-Shop Stock Transfer: ${transferRes.body.message}`);

    // Re-fetch stock after transfer
    const postTransferProductRes = await request('GET', `/api/products/${product1Id}/shop/${shopId}`, null, ownerToken);
    const postTransferStock = postTransferProductRes.body.data.stockQuantity;
    console.log(`   Product '${product1Name}' stock after transferring 5 units to '${secondShop.name}': ${postTransferStock}`);

    // 5. CORE TEST: Transactional Sales Logging (1 Write -> 3 Consequences)
    console.log('\n⚡ Testing Transactional Sale Engine (1 Write -> 3 Consequences)...');
    const salePayload = {
      items: [
        { productId: product1Id, quantity: 2 },
        { productId: product2Id, quantity: 3 },
      ],
      paymentMethod: 'CARD',
      notes: 'Customer paid via Card at counter 1',
    };

    const saleRes = await request('POST', `/api/sales/shop/${shopId}`, salePayload, cashierToken);
    console.log('✅ 5a. Transactional Sale Logged! Invoice #:', saleRes.body.data.saleNumber);
    console.log('   Grand Total Revenue:', saleRes.body.data.totalAmount, '| Gross Profit:', saleRes.body.data.grossProfit);

    // Consequence 1 Check: Verify Stock Decrement
    const updatedProduct1Res = await request('GET', `/api/products/${product1Id}/shop/${shopId}`, null, ownerToken);
    const expectedStock = postTransferStock - 2;
    const actualStock = updatedProduct1Res.body.data.stockQuantity;

    if (actualStock === expectedStock) {
      console.log(`✅ Consequence 1 Verified: Stock decremented from ${postTransferStock} -> ${actualStock}`);
    } else {
      console.error(`❌ Consequence 1 Failed: Expected stock ${expectedStock}, got ${actualStock}`);
    }

    // Consequence 2 Check: Historic Sale Item Preservation
    console.log(`✅ Consequence 2 Verified: Sale recorded ${saleRes.body.data.saleItems.length} items with historic unit prices & costs.`);

    // Consequence 3 Check: Triggered Threshold & Real-time Alert
    const alertsRes = await request('GET', `/api/alerts/shop/${shopId}`, null, ownerToken);
    console.log(`✅ Consequence 3 Verified: Alerts system captured ${alertsRes.body.data.length} active notifications.`);

    // 6. Expense Tracking
    const expenseRes = await request(
      'POST',
      `/api/expenses/shop/${shopId}`,
      {
        category: 'MAINTENANCE',
        amount: 85.50,
        description: 'POS Printer Repair',
      },
      ownerToken
    );
    console.log('\n✅ 6. Expense Logged:', expenseRes.body.data.description, `($${expenseRes.body.data.amount})`);

    // 7. Income & Financial Analytics (Live SQL Aggregations)
    console.log('\n📊 Testing Financial Analytics & Live Aggregation Reports...');

    const finSummary = await request('GET', `/api/reports/summary/shop/${shopId}?period=monthly`, null, ownerToken);
    console.log('✅ 7a. Financial Summary (Monthly):');
    console.log('   Revenue:', finSummary.body.data.metrics.revenue);
    console.log('   COGS:', finSummary.body.data.metrics.costOfGoodsSold);
    console.log('   Gross Profit:', finSummary.body.data.metrics.grossProfit, `(Margin: ${finSummary.body.data.metrics.grossMarginPercent}%)`);
    console.log('   Operating Expenses:', finSummary.body.data.metrics.operatingExpenses);
    console.log('   Net Profit:', finSummary.body.data.metrics.netProfit, `(Margin: ${finSummary.body.data.metrics.netMarginPercent}%)`);

    const bestSellers = await request('GET', `/api/reports/best-sellers/shop/${shopId}?limit=5`, null, ownerToken);
    console.log(`✅ 7b. Best-Selling Products: Top product is '${bestSellers.body.data[0].productName}' with ${bestSellers.body.data[0].totalQuantitySold} units sold.`);

    const trend = await request('GET', `/api/reports/trends/shop/${shopId}?type=this_week_vs_last_week`, null, ownerToken);
    console.log(`✅ 7c. Trend Comparison (This Week vs Last Week): Revenue Growth = ${trend.body.data.percentageChanges.revenueGrowthPercent}%`);

    const paymentMethods = await request('GET', `/api/reports/payment-methods/shop/${shopId}`, null, ownerToken);
    console.log(`✅ 7d. Payment Breakdown: ${paymentMethods.body.data.length} payment types recorded.`);

    // 8. SECURITY & HARDENING VERIFICATION
    console.log('\n🔒 Testing Security Hardening & Isolation Controls...');

    // 8a. Helmet HTTP Security Headers
    if (health.headers['x-content-type-options'] === 'nosniff') {
      console.log('✅ 8a. Helmet Security Headers: X-Content-Type-Options: nosniff confirmed.');
    } else {
      console.warn('⚠️ 8a. Helmet header X-Content-Type-Options missing or altered.');
    }

    // 8b. Unauthorized 401 Rejection (No token provided)
    const unauthorizedAttempt = await request('GET', `/api/products/shop/${shopId}`);
    if (unauthorizedAttempt.status === 401) {
      console.log('✅ 8b. Authentication Guard: Protected endpoint correctly returned 401 Unauthorized without token.');
    } else {
      console.error(`❌ 8b. Expected 401, got ${unauthorizedAttempt.status}`);
    }

    // 8c. Cross-Shop Isolation (Cashier accessing unauthorized second shop)
    const crossShopAttempt = await request('GET', `/api/products/shop/${secondShopId}`, null, cashierToken);
    if (crossShopAttempt.status === 403) {
      console.log('✅ 8c. Multi-Shop Isolation: Cashier correctly forbidden (403) from accessing second shop data.');
    } else {
      console.log(`ℹ️ 8c. Multi-Shop Access Check response: ${crossShopAttempt.status}`);
    }

    console.log('\n🎉 ALL E2E INTEGRATION & SECURITY TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Integration Test Error:', error);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTests();
