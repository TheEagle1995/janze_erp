import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: any) {
    const search     = params.search     as string  | undefined
    const brand      = params.brand      as string  | undefined
    const categoryId = params.categoryId as string  | undefined
    // URL query params arrive as strings — coerce explicitly
    const isActive   = params.isActive === 'false' || params.isActive === false ? false : true
    const page       = Math.max(1,   parseInt(String(params.page  ?? 1)))
    const limit      = Math.min(200, parseInt(String(params.limit ?? 20)))

    const where: any = { isActive }
    if (brand)      where.brand      = brand
    if (categoryId) where.categoryId = categoryId
    if (search)     where.name = { contains: search, mode: 'insensitive' }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { name: 'asc' },
        include: {
          category: { select: { id: true, name: true } },
          variants: {
            where: { isActive: true },
            include: { inventory: { select: { branchId: true, quantity: true, reservedQty: true, lowStockThreshold: true } } },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ])
    return { data: products, meta: { total, page, limit, lastPage: Math.ceil(total / limit) } }
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: { include: { inventory: true } },
      },
    })
    if (!product) throw new NotFoundException(`Product ${id} not found`)
    return product
  }

  async findByBarcode(barcode: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { barcode },
      include: {
        product:   true,
        inventory: true,
      },
    })
    if (!variant) throw new NotFoundException(`Barcode ${barcode} not found`)
    return variant
  }

  async create(data: any) {
    const { variants = [] } = data

    // Basic field validation — return 400 with a clear message
    if (!data.name?.trim())    throw new BadRequestException('Product name is required')
    if (!data.skuBase?.trim()) throw new BadRequestException('SKU Base is required')
    if (!data.sellPrice && data.sellPrice !== 0) throw new BadRequestException('Sell price is required')
    if (Number(data.sellPrice) <= 0)             throw new BadRequestException('Sell price must be greater than 0')
    if (variants.length === 0)                   throw new BadRequestException('At least one variant is required')
    if (variants.some((v: any) => !v.sku?.trim())) throw new BadRequestException('Every variant must have a SKU')

    // Explicitly pick only known Product fields — never spread unknown keys into Prisma
    const productData: any = {
      name:        String(data.name ?? '').trim(),
      brand:       data.brand       ?? 'AVERO',
      skuBase:     String(data.skuBase ?? '').trim(),
      costPrice:   Number(data.costPrice  ?? 0),
      sellPrice:   Number(data.sellPrice  ?? 0),
      description: data.description ?? null,
      imageUrls:   Array.isArray(data.imageUrls) ? data.imageUrls : [],
      tags:        Array.isArray(data.tags)       ? data.tags       : [],
      isActive:    data.isActive !== undefined ? Boolean(data.isActive) : true,
    }
    if (data.categoryId)   productData.category      = { connect: { id: data.categoryId } }
    if (data.isFlexiblePrice !== undefined)
                           productData.isFlexiblePrice = Boolean(data.isFlexiblePrice)

    let product: any
    try {
      product = await this.prisma.product.create({
        data: {
          ...productData,
          variants: {
            create: variants.map((v: any) => ({
              sku:           String(v.sku ?? '').trim(),
              barcode:       v.barcode       ? String(v.barcode).trim()  : null,
              size:          v.size          ? String(v.size).trim()     : null,
              color:         v.color         ? String(v.color).trim()    : null,
              colorHex:      v.colorHex      ? String(v.colorHex).trim() : null,
              priceOverride: v.priceOverride ? Number(v.priceOverride)   : null,
            })),
          },
        },
        include: { variants: true, category: true },
      })
    } catch (err: any) {
      // Duplicate SKU or barcode — return a clear 409 so the user knows what to fix
      if (err.code === 'P2002') {
        const field = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'sku or barcode'
        throw new ConflictException(`A product variant with this ${field} already exists. Please use a different SKU or barcode.`)
      }
      // If isFlexiblePrice column is missing (migration not yet applied), retry without it
      if (err.message?.includes('is_flexible_price') || err.code === 'P2022') {
        delete productData.isFlexiblePrice
        try {
          product = await this.prisma.product.create({
            data: {
              ...productData,
              variants: {
                create: variants.map((v: any) => ({
                  sku:           String(v.sku ?? '').trim(),
                  barcode:       v.barcode       ? String(v.barcode).trim()  : null,
                  size:          v.size          ? String(v.size).trim()     : null,
                  color:         v.color         ? String(v.color).trim()    : null,
                  colorHex:      v.colorHex      ? String(v.colorHex).trim() : null,
                  priceOverride: v.priceOverride ? Number(v.priceOverride)   : null,
                })),
              },
            },
            include: { variants: true, category: true },
          })
        } catch (innerErr: any) {
          if (innerErr.code === 'P2002') {
            const field = (innerErr.meta?.target as string[] | undefined)?.join(', ') ?? 'sku or barcode'
            throw new ConflictException(`A product variant with this ${field} already exists. Please use a different SKU or barcode.`)
          }
          throw innerErr
        }
      } else {
        throw err
      }
    }

    // Create initial inventory records for each variant × branch
    const inventoryRows: any[] = []
    for (const createdVariant of product.variants) {
      const formVariant = variants.find((v: any) => v.sku === createdVariant.sku)
      if (!formVariant?.stock) continue
      for (const [branchId, qty] of Object.entries(formVariant.stock as Record<string, number>)) {
        if (!branchId || branchId === '_default' || !qty) continue
        inventoryRows.push({ variantId: createdVariant.id, branchId, quantity: Number(qty), lowStockThreshold: 5 })
      }
    }
    if (inventoryRows.length) {
      await this.prisma.inventory.createMany({ data: inventoryRows, skipDuplicates: true })
    }

    return this.prisma.product.findUnique({
      where: { id: product.id },
      include: { variants: { include: { inventory: true } }, category: true },
    })
  }

  async update(id: string, data: any) {
    await this.findOne(id)

    // Explicitly pick only known Product fields
    const productData: any = {}
    if (data.name        !== undefined) productData.name        = String(data.name).trim()
    if (data.brand       !== undefined) productData.brand       = data.brand
    if (data.skuBase     !== undefined) productData.skuBase     = String(data.skuBase).trim()
    if (data.costPrice   !== undefined) productData.costPrice   = Number(data.costPrice)
    if (data.sellPrice   !== undefined) productData.sellPrice   = Number(data.sellPrice)
    if (data.description !== undefined) productData.description = data.description ?? null
    if (data.imageUrls   !== undefined) productData.imageUrls   = Array.isArray(data.imageUrls) ? data.imageUrls : []
    if (data.tags        !== undefined) productData.tags        = Array.isArray(data.tags) ? data.tags : []
    if (data.isActive    !== undefined) productData.isActive    = Boolean(data.isActive)
    if (data.categoryId  !== undefined) {
      if (data.categoryId) productData.category = { connect: { id: data.categoryId } }
      else                 productData.categoryId = null   // clear via scalar field
    }
    if (data.isFlexiblePrice !== undefined) productData.isFlexiblePrice = Boolean(data.isFlexiblePrice)

    try {
      return await this.prisma.product.update({
        where: { id },
        data:  productData,
        include: { variants: true, category: true },
      })
    } catch (err: any) {
      if (err.message?.includes('is_flexible_price') || err.code === 'P2022') {
        delete productData.isFlexiblePrice
        return this.prisma.product.update({
          where: { id },
          data:  productData,
          include: { variants: true, category: true },
        })
      }
      throw err
    }
  }

  async remove(id: string) {
    await this.findOne(id)
    return this.prisma.product.update({ where: { id }, data: { isActive: false } })
  }

  async getCategories(brand?: string) {
    return this.prisma.productCategory.findMany({
      where: { isActive: true, ...(brand ? { brand: brand as any } : {}) },
      orderBy: { name: 'asc' },
    })
  }

  /**
   * Bulk-import products parsed on the frontend from .xlsx / .csv
   * Each row: { name, sku, brand, category, costPrice, sellPrice, size, color, barcode, initialStock, description }
   * Returns: { created, skipped, errors }
   */
  async bulkImport(rows: any[], branchId?: string) {
    let created = 0, skipped = 0
    const errors: string[] = []

    for (const [idx, row] of rows.entries()) {
      const rowNum = idx + 2  // row 1 = header
      try {
        if (!row.name?.trim()) { errors.push(`Row ${rowNum}: name is required`); skipped++; continue }

        const sellPrice = Number(row.sellPrice ?? 0)
        const costPrice = Number(row.costPrice ?? 0)
        if (isNaN(sellPrice)) { errors.push(`Row ${rowNum}: invalid sellPrice`); skipped++; continue }

        // Auto-generate SKU if missing
        const sku = row.sku?.trim() || `${row.name.slice(0,6).toUpperCase().replace(/\s/g,'')}-${Date.now()}-${idx}`

        // Deduplicate: skip if SKU already exists
        const existing = await this.prisma.productVariant.findFirst({ where: { sku } })
        if (existing) { skipped++; continue }

        const product = await this.prisma.product.create({
          data: {
            name:        row.name.trim(),
            skuBase:     sku,
            brand:       (row.brand?.trim() || 'AVERO') as any,
            description: row.description?.trim() ?? null,
            sellPrice,
            costPrice,
            isActive:    true,
            variants: {
              create: [{
                sku,
                barcode:  row.barcode?.toString()?.trim() ?? null,
                size:     row.size?.toString()?.trim()    ?? null,
                color:    row.color?.toString()?.trim()   ?? null,
                isActive: true,
              }],
            },
          },
          include: { variants: true },
        })

        // Create initial inventory if branchId and initialStock provided
        const qty = Number(row.initialStock ?? 0)
        if (qty > 0 && (branchId || row.branchId)) {
          await this.prisma.inventory.createMany({
            data: product.variants.map(v => ({
              variantId: v.id,
              branchId:  branchId ?? row.branchId,
              quantity:  qty,
              lowStockThreshold: 5,
            })),
            skipDuplicates: true,
          })
        }

        created++
      } catch (err: any) {
        errors.push(`Row ${rowNum}: ${err.message}`)
        skipped++
      }
    }

    return { created, skipped, errors, total: rows.length }
  }
}
