import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { ProductsService } from './products.service'
import { JwtAuthGuard }   from '../../common/guards/jwt-auth.guard'
import { RolesGuard }     from '../../common/guards/roles.guard'

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private service: ProductsService) {}

  @Get()              @ApiOperation({ summary: 'List products with search/filter' })
  findAll(@Query() q: any) { return this.service.findAll(q) }

  @Get('categories')  @ApiOperation({ summary: 'List product categories' })
  getCategories(@Query('brand') brand?: string) { return this.service.getCategories(brand) }

  @Get('barcode/:barcode') @ApiOperation({ summary: 'Find product by barcode (POS scan)' })
  findByBarcode(@Param('barcode') barcode: string) { return this.service.findByBarcode(barcode) }

  @Get(':id')         @ApiOperation({ summary: 'Get single product' })
  findOne(@Param('id') id: string) { return this.service.findOne(id) }

  @Post()             @ApiOperation({ summary: 'Create product' })
  create(@Body() body: any) { return this.service.create(body) }

  @Post('bulk-import') @ApiOperation({ summary: 'Bulk import products from parsed Excel/CSV rows' })
  bulkImport(@Body() body: { rows: any[]; branchId?: string }) {
    return this.service.bulkImport(body.rows, body.branchId)
  }

  @Put(':id')         @ApiOperation({ summary: 'Update product' })
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body) }

  @Delete(':id')      @ApiOperation({ summary: 'Soft-delete product' })
  remove(@Param('id') id: string) { return this.service.remove(id) }
}
