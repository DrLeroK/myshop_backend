import { PrismaClient, Role, PaymentMethod, ExpenseCategory, PackageType, SubscriptionStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting myshop_backend SaaS database seeding...');

  // Clean existing data in reverse dependency order
  await prisma.subscriptionPayment.deleteMany();
  await prisma.shopSubscription.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.shop.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Database cleaned.');

  const hashedPassword = await bcrypt.hash('Password123!', 10);

  // 1. Create Super Admin
  const admin = await prisma.user.create({
    data: {
      name: 'Global SaaS Administrator',
      email: 'admin@myshop.com',
      password: hashedPassword,
      role: Role.SUPER_ADMIN,
    },
  });

  // 2. Create Store Owner (Active Subscription)
  const owner = await prisma.user.create({
    data: {
      name: 'Sarah Connor (Store Owner)',
      email: 'owner@myshop.com',
      password: hashedPassword,
      role: Role.OWNER,
    },
  });

  // 3. Create Pending Owner (Payment Pending Approval)
  const pendingOwner = await prisma.user.create({
    data: {
      name: 'Michael Scott (Pending SaaS Sign-up)',
      email: 'pending_owner@myshop.com',
      password: hashedPassword,
      role: Role.OWNER,
    },
  });

  // 4. Create Multi-Shops
  const shopMain = await prisma.shop.create({
    data: {
      name: 'Apex Supermarket & Groceries',
      address: '100 Main Boulevard, Downtown',
      phone: '+1-555-0199',
      currency: 'USD',
      ownerId: owner.id,
    },
  });

  const shopExpress = await prisma.shop.create({
    data: {
      name: 'Apex Express Metro',
      address: '45 Station Square, Transit Center',
      phone: '+1-555-0288',
      currency: 'USD',
      ownerId: owner.id,
    },
  });

  const shopPending = await prisma.shop.create({
    data: {
      name: 'Dunder Mifflin Retail Depot',
      address: '1725 Slough Avenue, Scranton',
      phone: '+1-555-0399',
      currency: 'USD',
      ownerId: pendingOwner.id,
    },
  });

  // 5. Create Staff Users (Manager & Cashier) assigned to shopMain
  const manager = await prisma.user.create({
    data: {
      name: 'Dwight Schrute',
      email: 'manager@myshop.com',
      password: hashedPassword,
      role: Role.MANAGER,
      shopId: shopMain.id,
    },
  });

  const cashier = await prisma.user.create({
    data: {
      name: 'John Doe',
      email: 'cashier@myshop.com',
      password: hashedPassword,
      role: Role.CASHIER,
      shopId: shopMain.id,
    },
  });

  console.log(`👤 Users created:
    - Super Admin: ${admin.email}
    - Store Owner: ${owner.email}
    - Pending Owner: ${pendingOwner.email}
    - Manager: ${manager.email}
    - Cashier: ${cashier.email}`);

  // 6. Create Shop Subscriptions
  const startDate = new Date();
  const endDateMain = new Date();
  endDateMain.setDate(startDate.getDate() + 365); // 1 Year package active

  await prisma.shopSubscription.create({
    data: {
      shopId: shopMain.id,
      ownerId: owner.id,
      packageType: PackageType.ONE_YEAR,
      amount: 5000.0,
      paymentProofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800',
      status: SubscriptionStatus.ACTIVE,
      startDate,
      endDate: endDateMain,
      adminNotes: 'Subscription verified and activated by Super Admin.',
    },
  });

  await prisma.shopSubscription.create({
    data: {
      shopId: shopExpress.id,
      ownerId: owner.id,
      packageType: PackageType.ONE_MONTH,
      amount: 600.0,
      paymentProofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800',
      status: SubscriptionStatus.ACTIVE,
      startDate,
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3), // 3 days remaining (Warning state!)
      adminNotes: 'Addon store subscription active - expires soon.',
    },
  });

  await prisma.shopSubscription.create({
    data: {
      shopId: shopPending.id,
      ownerId: pendingOwner.id,
      packageType: PackageType.THREE_MONTHS,
      amount: 1500.0,
      paymentProofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800',
      status: SubscriptionStatus.PENDING_APPROVAL,
      adminNotes: 'Payment proof submitted. Awaiting Admin review.',
    },
  });

  console.log('💳 Shop subscriptions & SaaS packages created.');

  // 7. Create Categories for Main Shop
  const catGroceries = await prisma.category.create({
    data: { shopId: shopMain.id, name: 'Groceries', description: 'Fresh produce, staples & dairy' },
  });

  const catBeverages = await prisma.category.create({
    data: { shopId: shopMain.id, name: 'Beverages', description: 'Soft drinks, juices & water' },
  });

  const catHousehold = await prisma.category.create({
    data: { shopId: shopMain.id, name: 'Household', description: 'Cleaning supplies & home essentials' },
  });

  const catPersonal = await prisma.category.create({
    data: { shopId: shopMain.id, name: 'Personal Care', description: 'Hygiene & skincare items' },
  });

  // 8. Create Products
  const productsData = [
    {
      categoryId: catGroceries.id,
      name: 'Whole Milk 1L',
      sku: 'GROC-001',
      stockQuantity: 45,
      lowStockThreshold: 10,
      costPrice: 1.20,
      sellingPrice: 2.50,
      unit: 'bottle',
    },
    {
      categoryId: catGroceries.id,
      name: 'Organic Whole Wheat Bread',
      sku: 'GROC-002',
      stockQuantity: 8,
      lowStockThreshold: 15,
      costPrice: 1.50,
      sellingPrice: 3.80,
      unit: 'loaf',
    },
    {
      categoryId: catGroceries.id,
      name: 'Extra Virgin Olive Oil 500ml',
      sku: 'GROC-003',
      stockQuantity: 25,
      lowStockThreshold: 5,
      costPrice: 4.50,
      sellingPrice: 9.99,
      unit: 'bottle',
    },
    {
      categoryId: catBeverages.id,
      name: 'Natural Spring Water 1.5L',
      sku: 'BEV-001',
      stockQuantity: 120,
      lowStockThreshold: 20,
      costPrice: 0.35,
      sellingPrice: 1.25,
      unit: 'bottle',
    },
    {
      categoryId: catBeverages.id,
      name: 'Dark Roast Coffee Beans 500g',
      sku: 'BEV-002',
      stockQuantity: 4,
      lowStockThreshold: 10,
      costPrice: 6.00,
      sellingPrice: 14.50,
      unit: 'bag',
    },
    {
      categoryId: catBeverages.id,
      name: 'Sparkling Orange Juice 330ml',
      sku: 'BEV-003',
      stockQuantity: 60,
      lowStockThreshold: 15,
      costPrice: 0.80,
      sellingPrice: 2.20,
      unit: 'can',
    },
  ];

  const products = [];
  for (const p of productsData) {
    const prod = await prisma.product.create({
      data: {
        shopId: shopMain.id,
        ...p,
      },
    });
    products.push(prod);
  }

  console.log(`📦 Created ${products.length} products for ${shopMain.name}.`);

  // 9. Generate Historical Sales
  const now = new Date();
  const paymentMethods: PaymentMethod[] = [PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.MOBILE_MONEY];

  for (let dayOffset = 15; dayOffset >= 0; dayOffset--) {
    const saleDate = new Date();
    saleDate.setDate(now.getDate() - dayOffset);
    const salesCountToday = Math.floor(Math.random() * 3) + 2;

    for (let s = 0; s < salesCountToday; s++) {
      saleDate.setHours(9 + s * 2, Math.floor(Math.random() * 59));
      const selectedProducts = products.slice().sort(() => 0.5 - Math.random()).slice(0, 2);
      
      let totalAmount = 0;
      let totalCost = 0;
      const saleItemsData = [];

      for (const prod of selectedProducts) {
        const qty = Math.floor(Math.random() * 2) + 1;
        const unitPrice = Number(prod.sellingPrice);
        const unitCost = Number(prod.costPrice);
        const subtotal = unitPrice * qty;
        const profit = (unitPrice - unitCost) * qty;

        totalAmount += subtotal;
        totalCost += unitCost * qty;

        saleItemsData.push({
          productId: prod.id,
          quantity: qty,
          unitPrice,
          unitCost,
          subtotal,
          profit,
        });
      }

      await prisma.sale.create({
        data: {
          saleNumber: `INV-${saleDate.getTime().toString().slice(-6)}-${s}`,
          shopId: shopMain.id,
          cashierId: cashier.id,
          totalAmount,
          totalCost,
          grossProfit: totalAmount - totalCost,
          paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
          createdAt: saleDate,
          saleItems: {
            create: saleItemsData,
          },
        },
      });
    }
  }

  // 10. Generate Expenses
  await prisma.expense.create({
    data: {
      shopId: shopMain.id,
      userId: owner.id,
      category: ExpenseCategory.RENT,
      amount: 1200,
      description: 'Monthly Store Lease Payment',
      expenseDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
    },
  });

  // 11. Subscription warning alert
  await prisma.alert.create({
    data: {
      shopId: shopExpress.id,
      type: 'SUBSCRIPTION_WARNING',
      severity: 'WARNING',
      title: 'Subscription Expiration Warning',
      message: 'Your monthly subscription for Apex Express Metro will expire in 3 days. Please renew to avoid service interruption.',
    },
  });

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
