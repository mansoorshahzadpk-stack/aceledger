import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getIncomeStatementFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { businessId: string; fromDate: string; toDate: string }) => d)
  .handler(async ({ context, input }) => {
    const { supabase } = context;
    const { businessId, fromDate, toDate } = input;

    // Fetch posted invoices in date range
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, total, status, issue_date")
      .eq("status", "posted")
      .eq("business_id", businessId)
      .gte("issue_date", fromDate)
      .lte("issue_date", toDate);

    // Fetch posted GRNs in date range
    const { data: grns } = await supabase
      .from("vendor_grns")
      .select("id, total_amount, status, grn_date")
      .eq("status", "posted")
      .eq("business_id", businessId)
      .gte("grn_date", fromDate)
      .lte("grn_date", toDate);

    // Fetch ledger transactions in date range
    const { data: ledgerTxs } = await supabase
      .from("ledger_transactions" as any)
      .select("id, amount, category, type, transaction_date")
      .eq("business_id", businessId)
      .gte("transaction_date", fromDate)
      .lte("transaction_date", toDate);

    const revenue = (invoices ?? []).reduce((sum, item) => sum + Number(item.total), 0);
    const cogs = (grns ?? []).reduce((sum, item) => sum + Number(item.total_amount), 0);
    const grossProfit = revenue - cogs;

    const opExpensesList: any[] = [];
    const minorIncomesList: any[] = [];
    const expensesByCategory: Record<string, number> = {};
    const minorIncomesByCategory: Record<string, number> = {};

    (ledgerTxs ?? []).forEach((tx: any) => {
      const amt = Number(tx.amount);
      if (tx.type === "credit") {
        expensesByCategory[tx.category] = (expensesByCategory[tx.category] || 0) + amt;
        opExpensesList.push(tx);
      } else {
        minorIncomesByCategory[tx.category] = (minorIncomesByCategory[tx.category] || 0) + amt;
        minorIncomesList.push(tx);
      }
    });

    const totalExpenses = Object.values(expensesByCategory).reduce((sum, val) => sum + val, 0);
    const totalMinorIncomes = Object.values(minorIncomesByCategory).reduce((sum, val) => sum + val, 0);
    const netProfit = grossProfit - totalExpenses + totalMinorIncomes;

    return {
      revenue,
      cogs,
      grossProfit,
      totalExpenses,
      totalMinorIncomes,
      netProfit,
      expensesByCategory,
      minorIncomesByCategory,
      opExpensesList,
      minorIncomesList,
    };
  });

export const getBalanceSheetFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { businessId: string; asOfDate: string }) => d)
  .handler(async ({ context, input }) => {
    const { supabase } = context;
    const { businessId, asOfDate } = input;

    // 1. Fetch Assets
    const { data: assets } = await supabase
      .from("assets" as any)
      .select("*")
      .eq("business_id", businessId);

    // 2. Fetch Client Payments
    const { data: clientPayments } = await supabase
      .from("client_payments")
      .select("amount, asset_id, payment_date")
      .eq("business_id", businessId)
      .lte("payment_date", asOfDate);

    // 3. Fetch Vendor Payments
    const { data: vendorPayments } = await supabase
      .from("vendor_payments")
      .select("amount, asset_id, payment_date")
      .eq("business_id", businessId)
      .lte("payment_date", asOfDate);

    // 4. Fetch Ledger Transactions
    const { data: ledgerTxs } = await supabase
      .from("ledger_transactions" as any)
      .select("amount, asset_id, type, transaction_date")
      .eq("business_id", businessId)
      .lte("transaction_date", asOfDate);

    // Calculate dynamic cash balances
    const cashBalances = (assets ?? [])
      .filter((a: any) => a.type === "bank_account" || a.type === "petty_cash")
      .map((asset: any) => {
        const id = asset.id;
        const clientInflow = (clientPayments ?? [])
          .filter((p) => p.asset_id === id)
          .reduce((sum, p) => sum + Number(p.amount), 0);
        const ledgerInflow = (ledgerTxs ?? [])
          .filter((tx: any) => tx.asset_id === id && tx.type === "debit")
          .reduce((sum, tx: any) => sum + Number(tx.amount), 0);
        const vendorOutflow = (vendorPayments ?? [])
          .filter((p) => p.asset_id === id)
          .reduce((sum, p) => sum + Number(p.amount), 0);
        const ledgerOutflow = (ledgerTxs ?? [])
          .filter((tx: any) => tx.asset_id === id && tx.type === "credit")
          .reduce((sum, tx: any) => sum + Number(tx.amount), 0);

        const balance = Number(asset.initial_balance) + clientInflow + ledgerInflow - vendorOutflow - ledgerOutflow;
        return {
          id: asset.id,
          name: asset.name,
          type: asset.type,
          balance,
        };
      });

    const totalCash = cashBalances.reduce((sum, item) => sum + item.balance, 0);

    // 5. Fetch Client Outstanding Balances (Receivables)
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name, opening_balance")
      .eq("business_id", businessId);

    const { data: clientInvoices } = await supabase
      .from("invoices")
      .select("id, total, status, issue_date, client_id")
      .eq("status", "posted")
      .eq("business_id", businessId)
      .lte("issue_date", asOfDate);

    const clientOutstandingBalances = (clients ?? []).map((c) => {
      const invoicesTotal = (clientInvoices ?? [])
        .filter((inv) => inv.client_id === c.id)
        .reduce((sum, inv) => sum + Number(inv.total), 0);
      const paymentsTotal = (clientPayments ?? [])
        .filter((p) => p.client_id === c.id)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const outstanding = Number(c.opening_balance) + invoicesTotal - paymentsTotal;
      return {
        id: c.id,
        name: c.name,
        outstanding,
      };
    });

    const totalReceivables = clientOutstandingBalances.reduce((sum, c) => sum + Math.max(0, c.outstanding), 0);

    // 6. Fetch Vendor Outstanding Balances (Payables)
    const { data: vendors } = await supabase
      .from("vendors")
      .select("id, name, opening_balance")
      .eq("business_id", businessId);

    const { data: vendorGrns } = await supabase
      .from("vendor_grns")
      .select("id, total_amount, status, grn_date, vendor_id, product_id, material, quantity, unit, unit_price")
      .eq("status", "posted")
      .eq("business_id", businessId)
      .lte("grn_date", asOfDate);

    const vendorOwedBalances = (vendors ?? []).map((v) => {
      const grnsTotal = (vendorGrns ?? [])
        .filter((g) => g.vendor_id === v.id)
        .reduce((sum, g) => sum + Number(g.total_amount), 0);
      const paymentsTotal = (vendorPayments ?? [])
        .filter((p) => p.vendor_id === v.id)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const owed = Number(v.opening_balance) + grnsTotal - paymentsTotal;
      return {
        id: v.id,
        name: v.name,
        owed,
      };
    });

    const totalPayables = vendorOwedBalances.reduce((sum, v) => sum + Math.max(0, v.owed), 0);

    // 7. Property & Equipment Valuations
    const totalProperty = (assets ?? [])
      .filter((a: any) => a.type === "property_equipment")
      .reduce((sum, a: any) => sum + Number(a.current_valuation), 0);

    // 8. Warehouse Inventory Value Calculation as of Date
    // Retrieve materials
    const { data: products } = await supabase
      .from("products" as any)
      .select("id, name, sku, unit")
      .eq("business_id", businessId);

    // Retrieve Invoice items posted before/on asOfDate
    const postedInvoiceIds = (clientInvoices ?? []).map((i) => i.id);
    let invoiceItems: any[] = [];
    if (postedInvoiceIds.length > 0) {
      const { data: items } = await supabase
        .from("invoice_items")
        .select("id, product_id, quantity, description, invoice_id")
        .in("invoice_id", postedInvoiceIds);
      invoiceItems = items ?? [];
    }

    // Weighted Average Cost calculation
    const materialMap = new Map<string, { name: string; sku: string | null; unit: string; received: number; delivered: number; receivedValue: number }>();
    
    (products ?? []).forEach((m: any) => {
      materialMap.set(m.id, { name: m.name, sku: m.sku, unit: m.unit, received: 0, delivered: 0, receivedValue: 0 });
    });

    (vendorGrns ?? []).forEach((g: any) => {
      const key = g.product_id ?? `_name:${(g.material || "").toLowerCase().trim()}`;
      let row = materialMap.get(key);
      if (!row) {
        row = { name: g.material || "(unlinked)", sku: null, unit: g.unit, received: 0, delivered: 0, receivedValue: 0 };
        materialMap.set(key, row);
      }
      row.received += Number(g.quantity);
      row.receivedValue += Number(g.total_amount);
    });

    invoiceItems.forEach((it: any) => {
      const key = it.product_id ?? `_name:${(it.description || "").toLowerCase().trim().split(" (")[0]}`;
      const row = materialMap.get(key);
      if (row) {
        row.delivered += Number(it.quantity);
      }
    });

    let totalInventoryValue = 0;
    materialMap.forEach((r) => {
      const onHand = r.received - r.delivered;
      const avgCost = r.received > 0 ? r.receivedValue / r.received : 0;
      const val = onHand > 0 ? onHand * avgCost : 0;
      totalInventoryValue += val;
    });

    // 9. Final equations
    const totalAssets = totalCash + totalReceivables + totalInventoryValue + totalProperty;
    const totalLiabilities = totalPayables;
    const equity = totalAssets - totalLiabilities;

    return {
      cashBalances,
      totalCash,
      clientBalances: clientOutstandingBalances,
      totalReceivables,
      vendorBalances: vendorOwedBalances,
      totalPayables,
      totalProperty,
      inventoryValue: totalInventoryValue,
      totalAssets,
      totalLiabilities,
      equity,
    };
  });
