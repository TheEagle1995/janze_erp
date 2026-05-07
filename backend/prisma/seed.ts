import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Branches
  const avero = await prisma.branch.upsert({
    where:  { id: 'aaaaaaaa-0000-0000-0000-000000000001' },
    update: {},
    create: { id: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'AVERO Main', brand: 'AVERO', address: 'Tashkent, Uzbekistan', phone: '+998901234567', currency: 'UZS', taxRate: 12 },
  })
  const janze = await prisma.branch.upsert({
    where:  { id: 'aaaaaaaa-0000-0000-0000-000000000002' },
    update: {},
    create: { id: 'aaaaaaaa-0000-0000-0000-000000000002', name: 'Janze Main', brand: 'JANZE', address: 'Tashkent, Uzbekistan', phone: '+998901234568', currency: 'UZS', taxRate: 12 },
  })

  // Users
  const adminHash = await bcrypt.hash('Admin@1234', 12)
  const adminPin  = await bcrypt.hash('0000', 10)
  await prisma.user.upsert({
    where:  { email: 'admin@avero.uz' },
    update: {},
    create: { branchId: avero.id, name: 'Super Admin', email: 'admin@avero.uz', passwordHash: adminHash, role: 'SUPER_ADMIN', pin: adminPin },
  })

  const mgrHash = await bcrypt.hash('Manager@1234', 12)
  const mgrPin  = await bcrypt.hash('1234', 10)
  await prisma.user.upsert({
    where:  { email: 'manager@avero.uz' },
    update: {},
    create: { branchId: avero.id, name: 'Manager', email: 'manager@avero.uz', passwordHash: mgrHash, role: 'MANAGER', pin: mgrPin },
  })

  const cashHash = await bcrypt.hash('Cashier@1234', 12)
  const cashPin  = await bcrypt.hash('5678', 10)
  await prisma.user.upsert({
    where:  { email: 'cashier@avero.uz' },
    update: {},
    create: { branchId: avero.id, name: 'Cashier', email: 'cashier@avero.uz', passwordHash: cashHash, role: 'CASHIER', pin: cashPin },
  })

  // Categories
  const categories = ['T-Shirts', 'Jeans', 'Jackets', 'Dresses', 'Shoes', 'Accessories']
  const cats: any[] = []
  for (const name of categories) {
    const cat = await prisma.productCategory.upsert({
      where:  { id: `cat-${name.toLowerCase().replace(/\s/g,'-')}` },
      update: {},
      create: { id: `cat-${name.toLowerCase().replace(/\s/g,'-')}`, name },
    })
    cats.push(cat)
  }

  // Sample products
  const products = [
    { name: 'Classic Tee',    skuBase: 'AVR-TEE-001',  brand: 'AVERO', cost: 15000, sell: 49000,  sizes: ['S','M','L','XL'] },
    { name: 'Slim Jeans',     skuBase: 'AVR-JNS-001',  brand: 'AVERO', cost: 40000, sell: 120000, sizes: ['28','30','32','34'] },
    { name: 'Bomber Jacket',  skuBase: 'JNZ-JKT-001',  brand: 'JANZE', cost: 90000, sell: 280000, sizes: ['S','M','L'] },
    { name: 'Floral Dress',   skuBase: 'JNZ-DRS-001',  brand: 'JANZE', cost: 55000, sell: 160000, sizes: ['XS','S','M','L'] },
    { name: 'Cargo Shorts',   skuBase: 'AVR-SHT-001',  brand: 'AVERO', cost: 28000, sell: 85000,  sizes: ['S','M','L','XL'] },
  ]

  for (const p of products) {
    const catIndex = p.brand === 'AVERO' ? 0 : 2
    await prisma.product.upsert({
      where:  { id: `product-${p.skuBase}` },
      update: {},
      create: {
        id:         `product-${p.skuBase}`,
        categoryId: cats[catIndex].id,
        brand:      p.brand as any,
        name:       p.name,
        skuBase:    p.skuBase,
        costPrice:  p.cost,
        sellPrice:  p.sell,
        imageUrls:  [],
        tags:       [p.brand.toLowerCase(), p.name.toLowerCase().split(' ')[0]],
        variants: {
          create: p.sizes.map((size, i) => ({
            sku:     `${p.skuBase}-${size}`,
            size,
            color:   'Black',
            colorHex: '#000000',
            inventory: {
              create: [
                { branchId: avero.id, quantity: 20, lowStockThreshold: 5 },
                { branchId: janze.id, quantity: 15, lowStockThreshold: 5 },
              ],
            },
          })),
        },
      },
    })
  }

  // Chart of Accounts
  const accounts = [
    { code: '1001', name: 'Cash in Register',  type: 'ASSET',   subtype: 'CASH',            sort: 10 },
    { code: '1002', name: 'Bank Account',       type: 'ASSET',   subtype: 'BANK',            sort: 11 },
    { code: '1010', name: 'Card Terminal Float',type: 'ASSET',   subtype: 'ACCOUNTS_RECEIVABLE', sort: 12 },
    { code: '1031', name: 'AVERO Inventory',    type: 'ASSET',   subtype: 'INVENTORY',       sort: 13 },
    { code: '1032', name: 'Janze Inventory',    type: 'ASSET',   subtype: 'INVENTORY',       sort: 14 },
    { code: '2010', name: 'VAT Payable',        type: 'LIABILITY',subtype: 'TAX_PAYABLE',    sort: 20 },
    { code: '2001', name: 'Accounts Payable',   type: 'LIABILITY',subtype: 'ACCOUNTS_PAYABLE', sort: 21 },
    { code: '4001', name: 'AVERO Sales',        type: 'REVENUE', subtype: 'SALES_REVENUE',   sort: 40 },
    { code: '4002', name: 'Janze Sales',        type: 'REVENUE', subtype: 'SALES_REVENUE',   sort: 41 },
    { code: '4010', name: 'Sales Discounts',    type: 'REVENUE', subtype: 'SALES_REVENUE',   sort: 42 },
    { code: '4020', name: 'Sales Returns',      type: 'REVENUE', subtype: 'SALES_REVENUE',   sort: 43 },
    { code: '5001', name: 'AVERO COGS',         type: 'EXPENSE', subtype: 'COST_OF_GOODS_SOLD', sort: 50 },
    { code: '5002', name: 'Janze COGS',         type: 'EXPENSE', subtype: 'COST_OF_GOODS_SOLD', sort: 51 },
    { code: '6001', name: 'Salaries',           type: 'EXPENSE', subtype: 'SALARIES',        sort: 60 },
    { code: '6010', name: 'Rent',               type: 'EXPENSE', subtype: 'RENT',            sort: 61 },
    { code: '6020', name: 'Utilities',          type: 'EXPENSE', subtype: 'UTILITIES',       sort: 62 },
    { code: '6030', name: 'Marketing',          type: 'EXPENSE', subtype: 'MARKETING',       sort: 63 },
    { code: '6090', name: 'Miscellaneous',      type: 'EXPENSE', subtype: 'OTHER_EXPENSE',   sort: 69 },
  ]

  for (const acc of accounts) {
    await prisma.financeAccount.upsert({
      where:  { code: acc.code },
      update: {},
      create: { code: acc.code, name: acc.name, type: acc.type as any, subtype: acc.subtype as any, sortOrder: acc.sort, currency: 'UZS' },
    })
  }

  // Sample customer
  await prisma.customer.upsert({
    where:  { phone: '+998901234567' },
    update: {},
    create: { name: 'Layla Karimova', phone: '+998901234567', email: 'layla@example.com', loyaltyPoints: 340, discountPct: 5 },
  })

  console.log('✅ Seed complete')
  console.log('')
  console.log('Default credentials:')
  console.log('  Admin:   admin@avero.uz    / Admin@1234    / PIN: 0000')
  console.log('  Manager: manager@avero.uz  / Manager@1234  / PIN: 1234')
  console.log('  Cashier: cashier@avero.uz  / Cashier@1234  / PIN: 5678')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
