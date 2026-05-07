import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, ParseUUIDPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard }          from '../../common/guards/jwt-auth.guard'
import { ExpenseService }        from './expenses/expense.service'
import { PLReportService }       from './reports/pl.report.service'
import { CashFlowService }       from './cashflow/cashflow.service'
import { BudgetService }         from './budgets/budget.service'
import { ReconciliationService } from './reconciliation/reconciliation.service'
import { AccountsService }       from './accounts/accounts.service'
import { JournalService }        from './journals/journal.service'

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(
    private expenses:   ExpenseService,
    private pl:         PLReportService,
    private cashflow:   CashFlowService,
    private budgets:    BudgetService,
    private recon:      ReconciliationService,
    private accounts:   AccountsService,
    private journal:    JournalService,
  ) {}

  // ── Accounts ──────────────────────────────────────────────────────────────
  @Get('accounts')             getAccounts(@Query('includeInactive') inc?: string) { return this.accounts.getChartOfAccounts(inc === 'true') }
  @Get('accounts/type/:type')  getByType(@Param('type') t: string) { return this.accounts.getByType(t as any) }
  @Post('accounts')            createAccount(@Body() b: any) { return this.accounts.create(b) }

  // ── Expenses ──────────────────────────────────────────────────────────────
  @Get('expenses')             listExpenses(@Query() q: any) { return this.expenses.findAll(q) }
  @Get('expenses/breakdown')   expenseBreakdown(@Query() q: any) { return this.expenses.getCategoryBreakdown(q) }
  @Get('expenses/:id')         getExpense(@Param('id') id: string) { return this.expenses.findOne(id) }
  @Post('expenses')            createExpense(@Body() b: any, @Request() req: any) { return this.expenses.create(b, req.user.id) }
  @Patch('expenses/:id/approve') approveExpense(@Param('id') id: string, @Body() b: any, @Request() req: any) { return this.expenses.approve(id, req.user.id, b) }
  @Patch('expenses/:id/reject')  rejectExpense(@Param('id') id: string, @Body() b: any, @Request() req: any) { return this.expenses.reject(id, req.user.id, b) }
  @Patch('expenses/:id/pay')     payExpense(@Param('id') id: string, @Body() b: any, @Request() req: any) { return this.expenses.markPaid(id, req.user.id, b.paymentNote) }

  // ── Reports ───────────────────────────────────────────────────────────────
  @Get('reports/profit-loss')  profitLoss(@Query() q: any) { return this.pl.generate(q) }
  @Get('reports/profit-loss/trend') plTrend(@Query() q: any) { return this.pl.getMonthlyTrend(q.branchId ?? null, parseInt(q.months) || 12) }
  @Get('reports/cash-flow')    cashFlow(@Query() q: any) { return this.cashflow.generate(q) }
  @Get('reports/cash-flow/daily') dailyCashFlow(@Query() q: any) { return this.cashflow.getDailyCashPosition(q.branchId, parseInt(q.days) || 30) }
  @Get('reports/cash-flow/projection') cashProjection(@Query('branchId') branchId: string) { return this.cashflow.getProjection(branchId) }
  @Get('reports/trial-balance') trialBalance(@Query() q: any) { return this.journal.getTrialBalance(q.branchId ?? null, q.asOf ? new Date(q.asOf) : new Date()) }

  // ── Budgets ───────────────────────────────────────────────────────────────
  @Get('budgets')              listBudgets(@Query('branchId') b?: string) { return this.budgets.findAll(b) }
  @Post('budgets')             createBudget(@Body() b: any, @Request() req: any) { return this.budgets.create(b, req.user.id) }
  @Get('budgets/:id/actual')   budgetActual(@Param('id') id: string) { return this.budgets.getBudgetActual(id) }

  // ── Reconciliation ────────────────────────────────────────────────────────
  @Post('reconciliation/open-shift')  openShift(@Body() b: any) { return this.recon.openShift(b) }
  @Patch('reconciliation/:id/close')  closeShift(@Param('id') id: string, @Body() b: any, @Request() req: any) { return this.recon.closeShift(id, b, req.user.id) }
  @Get('reconciliation/current')      getCurrentShift(@Query() q: any) { return this.recon.getCurrentShift(q.branchId, q.cashierId) }
  @Get('reconciliation/history')      getHistory(@Query() q: any) { return this.recon.getHistory(q.branchId, parseInt(q.days) || 30) }

  // ── Journals ──────────────────────────────────────────────────────────────
  @Get('journals')                    listJournals(@Query() q: any) { return this.journal.getEntries(q) }
  @Patch('journals/:id/void')         voidJournal(@Param('id') id: string, @Body() b: any, @Request() req: any) { return this.journal.voidEntry(id, b.reason, req.user.id) }
}
