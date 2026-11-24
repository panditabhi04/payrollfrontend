import { apiGet } from "./client";

export interface MenuNode {
  id: number;
  name: string;
  page: string | null;      // legacy click_evt (.aspx)
  children: MenuNode[];
}

export async function getMenu(): Promise<MenuNode[]> {
  try {
    const list = await apiGet<MenuNode[]>("/api/menu/", { credentials: "include" });
    // Ensure GPS Movement Tracking is easily accessible in top navbar
    for (const top of list) {
      const topName = (top.name || "").trim().toLowerCase();
      if (topName === "my profile") {
        if (!top.children.some((c) => c.page === "gps_tracking.aspx" || c.name.includes("GPS"))) {
          const logIdx = top.children.findIndex(
            (c) =>
              (c.name || "").toLowerCase().includes("android attendance logs") ||
              (c.page || "").toLowerCase().includes("android_attendances_logs")
          );
          const trackingNode: MenuNode = {
            id: 9991,
            name: " GPS Movement Tracking",
            page: "gps_tracking.aspx",
            children: [],
          };
          if (logIdx >= 0) {
            top.children.splice(logIdx + 1, 0, trackingNode);
          } else {
            top.children.push(trackingNode);
          }
        }
      }
      if (topName.includes("payroll")) {
        const att = top.children.find((c) => (c.name || "").trim().toLowerCase().includes("attendance"));
        if (att && !att.children.some((c) => c.page === "gps_tracking.aspx" || c.name.includes("GPS"))) {
          att.children.push({
            id: 9992,
            name: "GPS Movement Tracking",
            page: "gps_tracking.aspx",
            children: [],
          });
        }
      }
    }
    return list;
  } catch {
    return [];
  }
}

// Legacy .aspx page -> modern route, for screens that are already migrated.
const PAGE_ROUTES: Record<string, string> = {
  "account_department.aspx": "/account-department",
  "account_reports.aspx": "/transactions/account-reports",
  "apply_expencess.aspx": "/transactions/expense-claim",
  "app_rej_claim.aspx": "/transactions/approve-claims",
  "advance_policy.aspx": "/payroll/advance-policy",
  "android_attendances_details.aspx": "/attendance/android-details",
  "android_attendances_logs.aspx": "/attendance/android-logs",
  "gps_tracking.aspx": "/attendance/tracking",
  "employee_tracking.aspx": "/attendance/tracking",
  "emp_document_verification.aspx": "/hr/document-verification",
  "app_rej_travelplan.aspx": "/hr/approve-travel-plan",
  "assign_attendance_policy.aspx": "/attendance/assignments",
  "travelling_management.aspx": "/hr/assign-travel-employee",
  "assign_travel_employee.aspx": "/hr/assign-travel-employee",
  "assign_leave_ploicy.aspx": "/leave/assign",
  "receiver.aspx": "/hr/attendance-request",
  "client_request_form.aspx": "/hr/attendance-request",
  "days_approval.aspx": "/hr/attendance-approval",
  "attendancehistory.aspx": "/attendance/history",
  "attendance_policy_master.aspx": "/attendance/policies",
  "emp_sample.aspx": "/hr/attendance-sheet",
  "authorised_signatory.aspx": "/transactions/authorised-signatory",
  "balance_sheet_accounting.aspx": "/transactions/bank-statement",
  "birthday.aspx": "/hr/birthdays",
  "unitmaster.aspx": "/masters/unit",
  "unit_grade_rate_updation.aspx": "/masters/branch-wise-rate",
  "working_images.aspx": "/hr/working-images",
  "upload_bulk_attendance.aspx": "/hr/bulk-attendance",
  "change_password.aspx": "/account/change-password",
  "client_access.aspx": "/masters/client-access",
  "grade_unit_billing.aspx": "/payroll/client-billing",
  "client_dashboard.aspx": "/hr/client-dashboard",
  "userdashboard.aspx": "/user-dashboard",
  "clientmaster.aspx": "/masters/client",
  "companymaster.aspx": "/masters/company",
  "consumable.aspx": "/transactions/consumable-dispatch",
  "consumable_material_master.aspx": "/masters/consumable-material",
  "credit_note.aspx": "/transactions/credit-note",
  "manage_role.aspx": "/account/manage-role",
  "user_management.aspx": "/account/user-management",
  "grademaster.aspx": "/hr/grades",
  "download_conveyance_sheet.aspx": "/attendance/conveyance-download",
  "tab_employee_attendance_details.aspx": "/hr/attendance-images",
  "employee_bank_details_level_1.aspx": "/hr/kyc?level=1",
  "employee_bank_details.aspx": "/hr/kyc",
  "employee_salary_details.aspx": "/hr/employee-compliance",
  "employee_view_details.aspx": "/hr/employee-details",
  "employee_email_update.aspx": "/hr/employee-email-update",
  "employee_leave_check.aspx": "/leave/check",
  "employeemaster.aspx": "/hr/employees",
  "employee_pf_form.aspx": "/hr/pf-form",
  "new_employee_requirnment.aspx": "/hr/recruitment",
  "salary_slip.aspx": "/payroll/salary-slip",
  "payslip.aspx": "/payroll/payslip",
  "inventorypurchasebill.aspx": "/transactions/goods-receipt",
  "gstreports.aspx": "/transactions/gst-register",
  "help_desk.aspx": "/hr/help-desk",
  "ho_login.aspx": "/reports/portal-ho",
  "hod_approval.aspx": "/transactions/cash-voucher",
  "holidaymaster.aspx": "/masters/holiday",
  "hsn_master.aspx": "/masters/hsn-master",
  "income_tax.aspx": "/masters/income-tax",
  "itmaster.aspx": "/masters/it-master",
  "itemmaster.aspx": "/masters/item-master",
  "leave_form.aspx": "/leave/applications",
  "leavemaster.aspx": "/leave",
  "leave_form_management.aspx": "/leave/requests",
  "leagal_approval.aspx": "/hr/legal-compliance",
  "machin_maintainance_tracking.aspx": "/hr/machine-maintenance",
  "all_reports.aspx": "/reports",
  "menumaster.aspx": "/account/menu-master",
  "monthendprocess.aspx": "/payroll/month-end",
  "reports.aspx": "/reports/month-wise",
  "employeeinfo.aspx": "/hr/my-info",
  "offerletter.aspx": "/hr/offer-letter",
  "operation_management.aspx": "/hr/operation-management",
  "outstanding_report.aspx": "/transactions/outstanding-report",
  "grade_unit_salary.aspx": "/payroll/less-attendance",
  "payment_history.aspx": "/transactions/payment-history",
  "finance_dept.aspx": "/finance-dept",
  "paypro_upload.aspx": "/payroll/paypro-upload",
  "petty_cash.aspx": "/transactions/petty-cash-android",
  "cash_voucher1.aspx": "/transactions/cash-voucher",
  "travel_policy_master.aspx": "/hr/travel-policy",
  "billingdetails.aspx": "/payroll/policy-master",
  "ptslabmaster.aspx": "/masters/pt-slab",
  "purchase_order.aspx": "/transactions/purchase-order",
  "expense_report.aspx": "/reports/travel-expense",
  "reports_main.aspx": "/reports/salary",
  "reprint_invoice.aspx": "/transactions/reprint-invoice",
  "email_followup.aspx": "/transactions/email-followup",
  "ihms_employee_details.aspx": "/hr/resource-recruitment",
  "return_material.aspx": "/transactions/return-material",
  "salary_paid_report.aspx": "/reports/salary-paid",
  "emp_salary_slip.aspx": "/payroll/emp-salary-slip",
  "transaction.aspx": "/transactions/sales-order",
  "datatable.aspx": "/reports/search",
  "search_invoice.aspx": "/transactions/invoice-search",
  "pay_send_email.aspx": "/hr/send-email",
  "send_joining_letter.aspx": "/hr/joining-letter",
  "ihms_services.aspx": "/masters/service-category",
  "shift_calender.aspx": "/masters/shift-calendar",
  "shiftassign.aspx": "/masters/shift",
  "shift_report.aspx": "/reports/shift-reports",
  "site_audit_detail.aspx": "/masters/site-audit",
  "softcopy_email_send.aspx": "/hr/softcopy-mail",
  "staff_salary_details.aspx": "/payroll/staff-salary-details",
  "staff_salary_structure.aspx": "/payroll/staff-salary-structure",
  "statemaster.aspx": "/masters/state",
  "summary_report.aspx": "/reports/summary-report",
  "stipend_emp_business.aspx": "/payroll/stipend-business",
  "iteminventoryquery.aspx": "/transactions/stock",
  "backup_page.aspx": "/hr/system-backup",
  "task_master.aspx": "/masters/task-master",
  "todolist.aspx": "/hr/todo",
  "uniform_tracking.aspx": "/hr/uniform-tracking",
  "unit_login.aspx": "/reports/portal-unit",
  "vendormaster.aspx": "/masters/vendor-master",
  "reliance_image_upload.aspx": "/hr/site-images"
};

export function routeFor(page: string | null): string | null {
  if (!page) return null;
  return PAGE_ROUTES[page.trim().toLowerCase()] ?? null;
}
