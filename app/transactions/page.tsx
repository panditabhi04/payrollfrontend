import InvoiceManager from "@/components/InvoiceManager";

export const metadata = { title: "Invoices / Transactions" };

export default function TransactionsPage() {
  return (
    <main>
      <h1>Transactions</h1>
      <InvoiceManager />
    </main>
  );
}
