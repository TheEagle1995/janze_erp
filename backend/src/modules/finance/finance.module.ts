import { Module }                  from '@nestjs/common'
import { JournalService }          from './journals/journal.service'
import { ExpenseService }          from './expenses/expense.service'
import { PLReportService }         from './reports/pl.report.service'
import { CashFlowService }         from './cashflow/cashflow.service'
import { BudgetService }           from './budgets/budget.service'
import { ReconciliationService }   from './reconciliation/reconciliation.service'
import { AccountsService }         from './accounts/accounts.service'
import { FinanceController }       from './finance.controller'

@Module({
  providers: [
    JournalService, ExpenseService, PLReportService,
    CashFlowService, BudgetService, ReconciliationService, AccountsService,
  ],
  controllers: [FinanceController],
  exports:     [JournalService, ExpenseService],
})
export class FinanceModule {}
