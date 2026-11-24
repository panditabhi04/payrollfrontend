"use client";
/* Faithful port of BillingDetails.aspx (BILLING & SALARY MASTER).
 * Same field order, same labels, same dropdown options, same tabs,
 * same validation messages, same buttons (Save / Assign Policy / Delete / Close)
 * and same grid below. Cascades match the code-behind:
 * Client -> State -> Branch (Having / Not Having) -> Category ->
 * Designation -> Duty Hours. */
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getJSON, mk, putJSON, rm } from "@/lib/api/legacy-fetch";
import { deleteItem } from "@/lib/api/crud";
import ExportButtons from "@/components/ExportButtons";

const PM = () => "/api/payroll/billing-master/";

/* PF % shown read-only; refreshed from pay_company_pf_details on load (fallback = the values in the table today) */
const PF_DEFAULT = { employer: "13", employee: "12" };
interface ClientOpt { client_code: string; client_name: string; client_active_close?: string | null; billing_start_day?: string | number | null; billing_end_day?: string | number | null; }
interface UnitOpt { unit_code: string; unit_name: string; state_name: string; }
interface MachineOpt { item_code: string; item_name: string; }
/* staged Machine Rent Policy tab row (legacy gv_product_details ViewState row) */
interface MachineRow {
  machineCode: string; machineName: string; rateType: string;
  amount: string; qty: string; admin: string; tools: string;
  hc: string; inPer: string; inAmt: string;
}
interface DesigRow {
  state: string; designation: string; unit_code: string;
  hours: string; category: string;
  start_date?: string; end_date?: string;
}
type GridRow = Record<string, string | number | null> & { id: number };

type Opt = [string, string];
interface Spec {
  id: string; label: string;
  kind: "text" | "num" | "sel" | "multi" | "date" | "ro";
  opts?: Opt[]; model?: string; tab?: string; top?: boolean;
  w?: number; /* bootstrap column width: 2 = col-sm-2, 3 = col-sm-3 (purane jaisa) */
}

const YN: Opt[] = [["0", "No"], ["1", "Yes"]];
const YN_NA: Opt[] = [["0", "No"], ["1", "Yes"], ["2", "Not Applicable"], ["3", "Yearly"]];
const NA_APP: Opt[] = [["0", "Not Applicable"], ["1", "Applicable"]];
const NA_APP_SP: Opt[] = [["0", "Not Applicable"], ["1", " Applicable"]];

const TABS: [string, string][] = [
  ["home", "Common"], ["menu1", "Billing"], ["menu2", "Salary"],
  ["menu3", "Material"], ["menu4", "Deep Cleaning"], ["menu5", "Conveyance"],
  ["menu6", "Pest Control"], ["menu7", "Machine Rent Policy"], ["menu8", "R&M Service"],
  ["menu9", "Administrative Expenses"], ["menu10", "Shiftwise Rate"], ["menu11", "Incentive"],
  ["menu12", "Office Rent"], ["menu13", "Yearly Bill"],
];

/* ---- specs in exact page order (old control IDs kept as keys) ---- */
const TOP: Spec[] = [
  { id: "ddl_unit_client", label: "Client Name :", kind: "sel", opts: [["Select", "Select"]], top: true },
  { id: "ddl_policy", label: "Policy:", kind: "sel", opts: [["0", "Select"], ["1", "Statewise Policy"], ["2", "Branchwise Policy"]], top: true },
  { id: "ddl_clientwisestate", label: "State :", kind: "sel", opts: [["Select", "Select"]], top: true },
  { id: "ddl_unitcode", label: "Branch Having Policy :", kind: "multi", top: true, w: 3 },
  { id: "ddl_unitcode_without", label: "Branch Not Having Policy :", kind: "multi", opts: [["ALL", "ALL"]], top: true, w: 3 },
  { id: "txt_policy_name1", label: "New Policy Name:", kind: "text", model: "policy_name1", top: true },
  { id: "txt_start_date", label: "Start Date:", kind: "date", model: "start_date", top: true },
  { id: "txt_end_date", label: "End Date:", kind: "date", model: "end_date", top: true },
];

const COMMON: Spec[] = [
  { id: "ddl_category", label: "Categories :", kind: "sel", opts: [["Select", "Select"]], model: "category", tab: "home" },
  { id: "ddl_designation", label: "Designation :", kind: "multi", model: "designation", tab: "home" },
  { id: "ddl_hours", label: "Duty Hours :", kind: "sel", opts: [["", ""]], model: "hours", tab: "home" },
  { id: "ddl_month_calc", label: "Month Calculation :", kind: "sel", opts: [["0", "Select"], ["1", "CALENDER DAYS"], ["2", "WORKING DAYS"]], model: "month_calc", tab: "home" },
  { id: "txt_start_date_common", label: "Billing Start Day:", kind: "ro", model: "start_date_common", tab: "home" },
  { id: "txt_end_date_common", label: "Billing End Day:", kind: "ro", model: "end_date_common", tab: "home" },
  { id: "txt_other_allow", label: "Allowance :", kind: "num", model: "other_allow", tab: "home" },
  /* Applicable: a 0 Other Allowance takes the State Allowance master amount of the state (Billing and Salary tabs); Not Applicable: it never does */
  { id: "ddl_state_allowance", label: "State Allowance :", kind: "sel", opts: [["1", "Applicable"], ["0", "Not Applicable"]], model: "state_allowance_applicable", tab: "home" },
  { id: "ddl_esic_allow", label: "ESIC on Allowance Applicable:", kind: "sel", opts: [["1", "Yes"], ["0", "No"]], tab: "home" },
  { id: "ddl_ot_applicable", label: "OverTime (OT) Allowed:", kind: "sel", opts: [["0", "No"], ["1", "Yes"]], model: "ot_applicable", tab: "home" },
  { id: "ddl_esic_ot", label: "ESIC on OT Applicable:", kind: "sel", opts: [["0", "No"], ["1", "Yes"]], model: "esic_ot", tab: "home" },
  { id: "ddl_lwf_applicable", label: "LWF Applicable:", kind: "sel", opts: [["0", "No"], ["1", "Yes"]], model: "lwf_applicable", tab: "home" },
  { id: "ddl_gst_applicable", label: "GST Applicable:", kind: "sel", opts: [["1", "Yes"], ["0", "No"]], model: "billing_gst_applicable", tab: "home" },
  { id: "ddl_cmn_pf_app", label: "PF ON :", kind: "sel", opts: [["0", "Basic / VDA"], ["1", "Gross"], ["2", "Gross-HRA"], ["3", "Basic+CCA+Allowance"], ["4", "Basic+CCA+Allowance+Leave"]], model: "pf_cmn_on", tab: "home" },
  { id: "ddl_material_contract", label: "Material Contract :", kind: "sel", opts: [["0", "No"], ["1", "Fix"], ["2", "Sqr.Ft"], ["3", "Fix material"], ["4", "Employeewise"]], model: "material_contract", tab: "home" },
  { id: "ddl_dc_contract", label: "Deep Cleaning Applicable :", kind: "sel", opts: YN, model: "dc_contract", tab: "home" },
  { id: "ddl_conveyance_applicable", label: "Conveyance Applicable :", kind: "sel", opts: YN, model: "conveyance_applicable", tab: "home" },
  { id: "ddl_pc_contract", label: "Pest Control Applicable :", kind: "sel", opts: YN, model: "pc_contract", tab: "home" },
  { id: "ddl_machine_rental_app", label: "Machine Rental Applicable :", kind: "sel", opts: YN, model: "machine_rental_applicable", tab: "home" },
  { id: "ddl_bonus_app", label: "Bonus Applicable :", kind: "sel", opts: YN, model: "bonus_applicable", tab: "home" },
  { id: "ddl_leave_app", label: "Leave Applicable :", kind: "sel", opts: YN, model: "leave_applicable", tab: "home" },
  { id: "txt_conveyance_amount", label: "Travel Allowance :", kind: "num", model: "conveyance_amount", tab: "home" },
  { id: "ddl_med_insurance_applicable", label: "Medical Insurance :", kind: "sel", opts: [["0", "Not Applicable"], ["1", "Applicable"]], model: "medical_insurance_applicable", tab: "home" },
];

const BILLING: Spec[] = [
  { id: "txt_per_rate_billing", label: "Per Day Rate :", kind: "num", model: "per_rate", tab: "menu1" },
  { id: "txt_basic_billing", label: "Basic :", kind: "num", model: "basic", tab: "menu1" },
  { id: "txt_vda_billing", label: "VDA :", kind: "num", model: "vda", tab: "menu1" },
  { id: "txt_basic_vda_billing", label: "Basic + VDA :", kind: "ro", model: "basic_vda", tab: "menu1" },
  { id: "txt_hra_amount", label: "HRA Amount :", kind: "num", model: "hra_amount", tab: "menu1" },
  { id: "txt_hra_percent", label: "HRA Percent (%):", kind: "num", model: "hra_percent", tab: "menu1" },
  { id: "ddl_bonus_policy_aap_billing", label: "Bonus Policy Applicable:", kind: "sel", opts: [["0", "No"], ["1", "Yes"], ["2", "Yearly"]], model: "bonus_policy_aap_billing", tab: "menu1" },
  { id: "txt_bonus_amount_billing", label: "Bonus Amount : ", kind: "num", model: "bonus_amount_billing", tab: "menu1" },
  { id: "txt_bill_bonus_percent", label: "Bonus Percent (%) :", kind: "num", model: "bill_bonus_percent", tab: "menu1" },
  { id: "ddl_bonus_taxable_billing", label: "Bonus Taxable:", kind: "sel", opts: YN_NA, model: "bonus_taxable", tab: "menu1" },
  { id: "txt_gratuity_percent_billing", label: "Gratuity Percent (%):", kind: "num", model: "gratuity_percent", tab: "menu1" },
  { id: "ddl_gratuity_taxable_billing", label: "Gratuity for ESIC Taxable:", kind: "sel", opts: YN_NA, model: "gratuity_taxable", tab: "menu1" },
  { id: "txt_washing_billing", label: "Washing :", kind: "num", model: "washing", tab: "menu1" },
  { id: "txt_travelling_billing", label: "Travelling :", kind: "num", model: "travelling", tab: "menu1" },
  { id: "txt_education_billing", label: "Education :", kind: "num", model: "education", tab: "menu1" },
  { id: "txt_cca_billing", label: "CCA :", kind: "num", model: "cca", tab: "menu1" },
  { id: "txt_allowances_billing", label: "Other Allowances :", kind: "num", model: "allowances", tab: "menu1" },
  { id: "txt_national_holidays_billing", label: "National Holidays Count:", kind: "num", model: "national_holidays_count", tab: "menu1" },
  { id: "txt_leave_days_percent", label: "Leave Days Percent(%) :", kind: "num", model: "leave_days_percent", tab: "menu1" },
  { id: "txt_leave_days", label: "Leave Days :", kind: "num", model: "leave_days", tab: "menu1" },
  { id: "ddl_leave_taxable_billing", label: "Leave Taxable: ", kind: "sel", opts: YN_NA, model: "leave_taxable", tab: "menu1" },
  { id: "txt_bill_pf_percent", label: "PF Percent (%) :", kind: "num", model: "bill_pf_percent", tab: "menu1" },
  { id: "txt_bill_esic_percent", label: "ESIC Percent (%) :", kind: "num", model: "bill_esic_percent", tab: "menu1" },
  { id: "txt_bill_relieving", label: "Relieving Charges Percent (%):", kind: "num", model: "bill_relieving", tab: "menu1" },
  { id: "txt_bill_uniform_rate", label: "Uniform Rate :", kind: "num", model: "bill_uniform_rate", tab: "menu1" },
  { id: "txt_bill_uniform_percent", label: "Uniform Percent (%) :", kind: "num", model: "bill_uniform_percent", tab: "menu1" },
  { id: "txt_bill_oper_cost_amt", label: "Operational Cost Amount :", kind: "num", model: "bill_oper_cost_amt", tab: "menu1" },
  { id: "txt_bill_oper_cost_percent", label: "Operational Cost Percent (%) :", kind: "num", model: "bill_oper_cost_percent", tab: "menu1" },
  { id: "ddl_relieving_uniform", label: "Relieving Charge on Uniform:", kind: "sel", opts: YN, model: "relieving_uniform_billing", tab: "menu1" },
  { id: "ddl_bill_ser_uniform", label: "Service Charge on Uniform:", kind: "sel", opts: YN, model: "bill_ser_uniform", tab: "menu1" },
  { id: "ddl_bill_ser_operations", label: "Service Charge on Operational Cost:", kind: "sel", opts: YN, model: "bill_ser_operations", tab: "menu1" },
  { id: "txt_bill_service_charge", label: "Service Charge (%) :", kind: "num", model: "bill_service_charge", tab: "menu1" },
  { id: "txt_bill_service_charge_amount", label: "Service Charge Amount :", kind: "num", model: "bill_service_charge_amount", tab: "menu1" },
  { id: "ddl_ot_policy_billing", label: "Special Allowances Applicable(Only 12Hrs):", kind: "sel", opts: YN, model: "ot_policy_billing", tab: "menu1" },
  { id: "txt_ot_amount_billing", label: "Special Allowances :", kind: "num", model: "ot_amount_billing", tab: "menu1" },
  { id: "ddl_esic_oa_billing", label: "ESIC On Other Allowances:", kind: "sel", opts: [["1", "Yes"], ["0", "No"]], model: "esic_oa_billing", tab: "menu1" },
  { id: "txt_group_insurance", label: "Group Insurance :", kind: "num", model: "group_insurance_billing", tab: "menu1" },
  { id: "ddl_service_group_insurance", label: "Service Charge On Group Insurance:", kind: "sel", opts: [["1", "Yes"], ["0", "No"]], model: "service_group_insurance_billing", tab: "menu1" },
  { id: "ddl_lwf_act_man", label: "LWF Actual / Monthly:", kind: "sel", opts: [["0", "Monthly"], ["1", "Actual"]], model: "lwf_act_mon", tab: "menu1" },
  { id: "txt_medical_insurance", label: "Medical Insurance :", kind: "num", model: "medical_insurance_amount", tab: "menu1" },
  { id: "ddl_ser_charge_as_per", label: "service charge as per", kind: "sel", opts: [["0", "Fix Service Charge"], ["1", "As per Present Days"]], model: "ser_charge_as_per", tab: "menu1" },
];

const SALARY: Spec[] = [
  { id: "txt_per_rate_salary", label: "Per Day Rate :", kind: "num", model: "per_rate_salary", tab: "menu2" },
  { id: "txt_basic_salary", label: "Basic :", kind: "num", model: "basic_salary", tab: "menu2" },
  { id: "txt_vda_salary", label: "VDA :", kind: "num", model: "vda_salary", tab: "menu2" },
  { id: "txt_basic_vda_salary", label: "Basic + VDA :", kind: "ro", tab: "menu2" },
  { id: "txt_hra_amount_salary", label: "HRA Amount :", kind: "num", model: "hra_amount_salary", tab: "menu2" },
  { id: "txt_hra_percent_salary", label: "HRA Percent (%):", kind: "num", model: "hra_percent_salary", tab: "menu2" },
  { id: "ddl_bonus_policy_aap_salary", label: "Bonus Policy Applicable:", kind: "sel", opts: [["0", "No"], ["1", "Yes"], ["2", "Yearly"]], model: "bonus_policy_salary", tab: "menu2" },
  { id: "txt_bonus_amount_salary", label: "Bonus Amount : ", kind: "num", model: "sal_bonus_amount", tab: "menu2" },
  { id: "txt_sal_bonus", label: "Bonus Percent (%) :", kind: "num", model: "sal_bonus", tab: "menu2" },
  { id: "ddl_bonus_taxable_salary", label: "Bonus Taxable:", kind: "sel", opts: [["0", "No"], ["1", "Yes"], ["2", "Not Applicable"], ["3", "Advance Policy"], ["4", "Yearly"]], model: "bonus_taxable_salary", tab: "menu2" },
  { id: "txt_sal_graguity_per", label: "Gratuity Percent (%):", kind: "num", model: "gratuity_salary", tab: "menu2" },
  { id: "ddl_gratuity_taxable_salary", label: "Gratuity for ESIC Taxable:", kind: "sel", opts: YN_NA, model: "gratuity_taxable_salary", tab: "menu2" },
  { id: "txt_washing_salary", label: "Washing :", kind: "num", model: "washing_salary", tab: "menu2" },
  { id: "txt_travelling_salary", label: "Travelling :", kind: "num", model: "travelling_salary", tab: "menu2" },
  { id: "txt_education_salary", label: "Education :", kind: "num", model: "education_salary", tab: "menu2" },
  { id: "txt_cca_salary", label: "CCA :", kind: "num", model: "cca_salary", tab: "menu2" },
  { id: "txt_allowances_salary", label: "Other Allowances :", kind: "num", model: "allowances_salary", tab: "menu2" },
  { id: "ddl_leave_taxable_salary", label: "Leave Taxable:", kind: "sel", opts: [["0", "No"], ["1", "Yes"], ["2", "Not Applicable"], ["3", "Advance Policy"], ["4", "Yearly"]], model: "leave_taxable_salary", tab: "menu2" },
  { id: "txt_leave_days_salary", label: "Leave Days :", kind: "num", model: "leave_days_salary", tab: "menu2" },
  { id: "txt_leave_days_percent_salary", label: "Leave Days Percent(%) :", kind: "num", model: "leave_days_percent_salary", tab: "menu2" },
  { id: "txt_sal_pf", label: "PF Percent (%) :", kind: "num", model: "sal_pf", tab: "menu2" },
  { id: "txt_sal_esic", label: "ESIC Percent (%) :", kind: "num", model: "sal_esic", tab: "menu2" },
  { id: "txt_sal_uniform_percent", label: "Uniform Percent (%) :", kind: "num", model: "sal_uniform_percent", tab: "menu2" },
  { id: "txt_sal_uniform_rate", label: "Uniform Rate :", kind: "num", model: "sal_uniform_rate", tab: "menu2" },
  { id: "ddl_pt_applicable", label: "PT Applicable:", kind: "sel", opts: YN, model: "pt_applicable", tab: "menu2" },
  { id: "ddl_ot_policy", label: "Special Allowances Applicable(Only 12Hrs):", kind: "sel", opts: YN, model: "ot_policy_salary", tab: "menu2" },
  { id: "txt_ot_amount", label: "Special Allowances :", kind: "num", model: "ot_amount_salary", tab: "menu2" },
  { id: "ddl_esic_oa_salary", label: "ESIC On Other Allowances:", kind: "sel", opts: [["1", "Yes"], ["0", "No"]], model: "esic_oa_salary", tab: "menu2" },
];

const MATERIAL: Spec[] = [
  { id: "txt_material_name", label: "Material Name :", kind: "text", tab: "menu3" },
  { id: "txt_contract_rate", label: "Rate :", kind: "num", model: "contract_amount", tab: "menu3" },
  { id: "ddl_machine_rental_applicable", label: "Machine Rental Applicable :", kind: "sel", opts: YN, model: "machine_rental_applicable", tab: "menu3" },
  { id: "txt_machine_rental_amount", label: "Machine Rental Amount :", kind: "num", model: "machine_rental_amount", tab: "menu3" },
  { id: "ddl_handling_charge", label: "Handling Charges Applicable :", kind: "sel", opts: YN, model: "handling_applicable", tab: "menu3" },
  { id: "txt_handling_percent", label: "Handling Charges(percentage):", kind: "num", model: "handling_percent", tab: "menu3" },
  { id: "txt_handling_amount", label: "Handling Charges(amount) :", kind: "num", model: "handling_charges_amount", tab: "menu3" },
  { id: "ddl_equmental_applicable", label: "EQUMENTAL RENTAL COST Applicable :", kind: "sel", opts: YN, model: "equmental_applicable", tab: "menu3" },
  { id: "txt_equment_rate", label: "No. Of unit :", kind: "num", model: "equmental_unit", tab: "menu3" },
  { id: "txt_equment_rental", label: "Rate Per Unit :", kind: "num", model: "equmental_rental_rate", tab: "menu3" },
  { id: "ddl_equmental_charges", label: "Handling Charges Applicable :", kind: "sel", opts: YN, model: "equmental_handling_applicable", tab: "menu3" },
  { id: "txt_equmental_percent", label: "Handling % :", kind: "num", model: "equmental_handling_percent", tab: "menu3" },
  { id: "ddl_chemical_applicable", label: "Chemical and Consumables Applicable :", kind: "sel", opts: YN, model: "chemical_applicable", tab: "menu3" },
  { id: "txt_chemical_unit", label: "No. Of unit :", kind: "num", model: "chemical_unit", tab: "menu3" },
  { id: "txt_chemical", label: "Rate Per Unit :", kind: "num", model: "chemical_consumables_rate", tab: "menu3" },
  { id: "ddl_chemical_charges", label: "Handling Charges Applicable :", kind: "sel", opts: YN, model: "chemical_handling_applicable", tab: "menu3" },
  { id: "txt_chemical_percent", label: "Handling % :", kind: "num", model: "chemical_handling_percent", tab: "menu3" },
  { id: "ddl_dustin_applicable", label: "Dustbin Liners Applicable :", kind: "sel", opts: YN, model: "dustbin_applicable", tab: "menu3" },
  { id: "txt_dustin_rate", label: "No. Of unit :", kind: "num", model: "dustbin_unit", tab: "menu3" },
  { id: "txt_dustin", label: "Rate Per Unit :", kind: "num", model: "dustbin_liners_rate", tab: "menu3" },
  { id: "ddl_dustin_charges", label: "Handling Charges Applicable :", kind: "sel", opts: YN, model: "dustbin_handling_applicable", tab: "menu3" },
  { id: "txt_dustin_percent", label: "Handling % :", kind: "num", model: "dustbin_handling_percent", tab: "menu3" },
  { id: "ddl_femina_applicable", label: "Femina Hygiene bin Applicable :", kind: "sel", opts: YN, model: "femina_applicable", tab: "menu3" },
  { id: "txt_femina_unit", label: "No. Of unit :", kind: "num", model: "femina_unit", tab: "menu3" },
  { id: "txt_femina", label: "Rate Per Unit :", kind: "num", model: "femina_hygiene_rate", tab: "menu3" },
  { id: "ddl_femina_charges", label: "Handling Charges Applicable :", kind: "sel", opts: YN, model: "femina_handling_applicable", tab: "menu3" },
  { id: "txt_femina_percent", label: "Handling % :", kind: "num", model: "femina_handling_percent", tab: "menu3" },
  { id: "ddl_aerosol_applicable", label: "Aerosol Dispenser Machines Applicable :", kind: "sel", opts: YN, model: "aerosol_applicable", tab: "menu3" },
  { id: "txt_aerosol_rate", label: "No. Of unit :", kind: "num", model: "aerosol_unit", tab: "menu3" },
  { id: "txt_aerosol", label: "Rate Per Unit :", kind: "num", model: "aerosol_dispenser_rate", tab: "menu3" },
  { id: "ddl_aerosol_charges", label: "Handling Charges Applicable :", kind: "sel", opts: YN, model: "aerosol_handling_applicable", tab: "menu3" },
  { id: "txt_aerosol_percent", label: "Handling % :", kind: "num", model: "aerosol_handling_percent", tab: "menu3" },
  { id: "ddl_tool_applicable", label: "Tool and Tackles Applicable :", kind: "sel", opts: YN, model: "tool_applicable", tab: "menu3" },
  { id: "txt_tool_unit", label: "No. Of unit :", kind: "num", model: "tool_unit", tab: "menu3" },
  { id: "txt_tool", label: "Rate Per Unit :", kind: "num", model: "tool_tackles_rate", tab: "menu3" },
  { id: "ddl_tool_charges", label: "Handling Charges Applicable :", kind: "sel", opts: YN, model: "tool_handling_applicable", tab: "menu3" },
  { id: "txt_tool_percent", label: "Handling % :", kind: "num", model: "tool_handling_percent", tab: "menu3" },
];

const REST: Spec[] = [
  { id: "ddl_dc_type", label: "Type :", kind: "sel", opts: [["0", "Select"], ["1", "Fix"], ["2", "Sqr.Feet"]], model: "dc_type", tab: "menu4" },
  { id: "txt_dc_rate", label: "Rate :", kind: "num", model: "dc_rate", tab: "menu4" },
  { id: "txt_dc_area", label: "Sq.Feet Area :", kind: "num", model: "dc_area", tab: "menu4" },
  { id: "ddl_dc_handling_charge", label: "Handling Charges Applicable :", kind: "sel", opts: YN, model: "dc_handling_charge", tab: "menu4" },
  { id: "txt_dc_handling_percent", label: "Handling % :", kind: "num", model: "dc_handling_percent", tab: "menu4" },
  { id: "ddl_conveyance_type", label: "Type :", kind: "sel", opts: [["0", "Select"], ["1", "Fix"], ["2", "Km"], ["3", "EmployeeWise"]], model: "conveyance_type", tab: "menu5" },
  { id: "txt_conveyance_rate", label: "Rate/Km :", kind: "num", model: "conveyance_rate", tab: "menu5" },
  { id: "txt_conveyance_km", label: "Total Km :", kind: "num", model: "conveyance_km", tab: "menu5" },
  { id: "ddl_conveyance_service_charge", label: "Conveyance Service Charge Applicable:", kind: "sel", opts: YN, model: "conveyance_service_charge", tab: "menu5" },
  { id: "txt_conveyance_service_charge", label: "In (%) :", kind: "num", model: "conveyance_service_charge_per", tab: "menu5" },
  { id: "txt_conveyance_service_amount", label: "In Amount :", kind: "num", model: "conveyance_service_amount", tab: "menu5" },
  { id: "txt_food_rate", label: "FOOD ALLOWANCE - Rate :", kind: "num", model: "food_allowance_rate", tab: "menu5" },
  { id: "txt_oc_rate", label: "OUTSTATION ALLOWANCE/CONVEYANCE - Rate :", kind: "num", model: "outstation_allowance_rate", tab: "menu5" },
  { id: "txt_os_rate", label: "OUTSTATION FOOD ALLOWANCE - Rate :", kind: "num", model: "outstation_food_allowance_rate", tab: "menu5" },
  { id: "txt_nh_rate", label: "NIGHT HALT - Rate :", kind: "num", model: "night_halt_rate", tab: "menu5" },
  { id: "txt_km_rate", label: "KM RATE - Rate :", kind: "num", model: "km_rate", tab: "menu5" },
  { id: "ddl_pc_type", label: "Type : ", kind: "sel", opts: [["0", "Select"], ["1", "Fix"], ["2", "Sqr.Feet"]], model: "pc_type", tab: "menu6" },
  { id: "txt_pc_rate", label: "Rate :", kind: "num", model: "pc_rate", tab: "menu6" },
  { id: "txt_pc_area", label: "Sq.Feet Area :", kind: "num", model: "pc_area", tab: "menu6" },
  { id: "ddl_pc_handling_charge", label: "Handling Charges Applicable :", kind: "sel", opts: YN, model: "pc_handling_charge", tab: "menu6" },
  { id: "txt_pc_handling_percent", label: "Handling % :", kind: "num", model: "pc_handling_percent", tab: "menu6" },
  { id: "ddl_service_charge", label: "Service Charge:", kind: "sel", opts: NA_APP, model: "service_charge_r_m", tab: "menu8" },
  { id: "txt_service_charge_rate", label: "Service Charge Rate(Rs) :", kind: "num", model: "rm_service_rate_rs", tab: "menu8" },
  { id: "txt_service_charge", label: "Service Charge Rate(%) :", kind: "num", model: "rm_service_rate_percent", tab: "menu8" },
  { id: "ddl_service_charge_adm", label: "Service Charge:", kind: "sel", opts: NA_APP, model: "service_charge_admini", tab: "menu9" },
  { id: "txt_rate_adm", label: "Service Charge Rate(Rs) :", kind: "num", model: "admini_service_rate_rs", tab: "menu9" },
  { id: "txt_ser_rate_adm", label: "Service Charge Rate(%) :", kind: "num", model: "admini_service_rate_percent", tab: "menu9" },
  { id: "txt_billing_rate", label: "Billing Rate :", kind: "num", model: "shift_billing_rate", tab: "menu10" },
  { id: "txt_salaray_rate", label: "Salary Rate :", kind: "num", model: "shift_salary_rate", tab: "menu10" },
  { id: "ddl_service_charge_appli", label: "Service Charges :", kind: "sel", opts: NA_APP_SP, model: "shift_service_charge", tab: "menu10" },
  { id: "txt_service_percent", label: "Service Charge Percent :", kind: "num", model: "shift_service_percent", tab: "menu10" },
  { id: "txt_service_amount", label: "Sevice Charge Amount: :", kind: "num", model: "shift_service_amount", tab: "menu10" },
  { id: "ddl_service_intensive", label: "Service Charge:", kind: "sel", opts: NA_APP, model: "incentive_service_applicable", tab: "menu11" },
  { id: "txt_incentive_service_RS", label: "Service Charge Rate(Rs) :", kind: "num", model: "incentive_service_charge_RS", tab: "menu11" },
  { id: "txt_incentive_service", label: "Service Charge Rate(%) :", kind: "num", model: "incentive_service_charge", tab: "menu11" },
  { id: "ddl_office_rent_applicable", label: "Office Rent Policy :", kind: "sel", opts: NA_APP_SP, model: "office_rent_applicable", tab: "menu12" },
  { id: "txt_office_bill_rate", label: "Billing Rate :", kind: "num", model: "office_rent_bill_rate", tab: "menu12" },
  { id: "txt_office_salary_rate", label: "Salary Rate :", kind: "num", model: "office_rent_salary_rate", tab: "menu12" },
  { id: "ddl_office_service_charge", label: "Service Charges :", kind: "sel", opts: NA_APP_SP, model: "office_rent_service_applicable", tab: "menu12" },
  { id: "txt_office_service_per", label: "Service Charge Percent :", kind: "num", model: "office_rent_service_per", tab: "menu12" },
  { id: "txt_office_service_amount", label: "Sevice Charge Amount: :", kind: "num", model: "office_rent_service_amount", tab: "menu12" },
  { id: "ddl_yearly_service_applicable", label: "Service Charges :", kind: "sel", opts: NA_APP_SP, model: "yearly_service_applicable", tab: "menu13" },
  { id: "txt_yearly_service_percent", label: "Service Charge Percent :", kind: "num", model: "yearly_service_percent", tab: "menu13" },
  { id: "txt_yearly_service_amount", label: "Sevice Charge Amount: :", kind: "num", model: "yearly_service_amount", tab: "menu13" },
];

const MACHINE_UI: Spec[] = [
  { id: "ddl_machine", label: "Select Machine:", kind: "sel", opts: [["Select", "Select"]], tab: "menu7" },
  { id: "ddl_rate_type", label: "Select Rate Type:", kind: "sel", opts: [["Select", "Select"], ["Fix Rate", "Fix Rate"], ["Per Hr. Rate", "Per Hr. Rate"], ["Per Day Rate", "Per Day Rate"], ["Per Sqft. Rate", "Per Sqft. Rate"]], tab: "menu7" },
  { id: "txt_machine_amount", label: "Amount:", kind: "num", tab: "menu7" },
  { id: "txt_machine_no_qty", label: "No. Quantity:", kind: "num", tab: "menu7" },
  { id: "txt_machine_admin_cost", label: "Admin Cost:", kind: "num", tab: "menu7" },
  { id: "txt_machine_tool_tackles", label: "Technical Tools:", kind: "num", tab: "menu7" },
  { id: "ddl_h_c_applicable", label: "Handling Charges Applicable:", kind: "sel", opts: [["No", "No"], ["Yes", "Yes"]], tab: "menu7" },
  { id: "txt_in_per", label: "In(%):", kind: "num", tab: "menu7" },
  { id: "txt_in_amt", label: "In(Amt):", kind: "num", tab: "menu7" },
];

const ALL = [...TOP, ...COMMON, ...BILLING, ...SALARY, ...MATERIAL, ...REST, ...MACHINE_UI];

function defaults(): Record<string, string> {
  const o: Record<string, string> = {
    ddl_unit_client: "Select", ddl_policy: "0", ddl_clientwisestate: "Select",
    txt_policy_name1: "", txt_start_date: "", txt_end_date: "",
    ddl_category: "Select", ddl_month_calc: "0", txt_start_date_common: "0",
    txt_end_date_common: "",
    /* exact legacy text_clear() defaults */
    txt_bill_bonus_percent: "8.33", txt_sal_bonus: "8.33",
    txt_gratuity_percent_billing: "4.81", txt_sal_graguity_per: "4.81",
    txt_bill_esic_percent: "3.25", txt_sal_esic: "0.75",
    txt_bill_pf_percent: PF_DEFAULT.employer, txt_sal_pf: PF_DEFAULT.employee,
    txt_bill_service_charge: "7", txt_bill_uniform_rate: "250",
    txt_national_holidays_billing: "4",
  };
  for (const s of ALL) {
    if (o[s.id] !== undefined) continue;
    o[s.id] = s.kind === "sel" ? (s.opts?.[0]?.[0] ?? "") : s.kind === "num" || s.kind === "ro" ? "0" : "";
  }
  return o;
}

/* Scoped replica of the old page CSS: Scripts/bootstrap.min.css essentials
 * (panels, grid cols, tabs, form-control, buttons, tables) + the page
 * <style> block + beige/jQuery-UI-tabs look of BillingDetails.aspx. */
const BD_CSS = `
.bd-old .container-fluid{padding-right:15px;padding-left:15px;margin-right:auto;margin-left:auto;max-width:99%}
.bd-old .row{margin:0}
.bd-old .row::after{content:"";display:table;clear:both}
.bd-old .col-xs-12{position:relative;min-height:1px;padding-right:15px;padding-left:15px;float:left;width:100%}
.bd-old .col-sm-1,.bd-old .col-sm-2,.bd-old .col-sm-3,.bd-old .col-sm-9,
.bd-old .col-md-1,.bd-old .col-md-2,.bd-old .col-md-3{position:relative;min-height:1px;padding-right:15px;padding-left:15px;float:left;width:100%}
@media(min-width:768px){
.bd-old .col-sm-1{width:8.33333333%}.bd-old .col-sm-2{width:16.66666667%}
.bd-old .col-sm-3{width:25%}.bd-old .col-sm-9{width:75%}
.bd-old .col-md-1{width:8.33333333%}.bd-old .col-md-2{width:16.66666667%}.bd-old .col-md-3{width:25%}
}
.bd-old .text-red{color:red}
.bd-old .text_box{margin-top:7px}
.bd-old .text-center{text-align:center}
.bd-old .text-right{text-align:right}
.bd-old .text-uppercase{text-transform:uppercase}
.bd-old h2{border-radius:5px}
.bd-old h5{font-weight:bold;font-size:15px}
.bd-old .panel{margin-bottom:20px;background-color:#fff;border:1px solid transparent;border-radius:4px;box-shadow:0 1px 1px rgba(0,0,0,.05)}
.bd-old .panel-primary{border-color:#337ab7}
.bd-old .panel-heading{padding:10px 15px;border-bottom:1px solid transparent;border-top-left-radius:3px;border-top-right-radius:3px;color:#fff;background-color:#337ab7;border-color:#337ab7}
.bd-old .panel-body{padding:15px}
.bd-old .panel-body::after{content:"";display:table;clear:both}
.bd-old .beige{background:beige;border-color:#c4c0c0}
.bd-old .nav{padding-left:0;margin-bottom:0;list-style:none}
.bd-old .nav::after{content:"";display:table;clear:both}
.bd-old .nav-tabs{border-bottom:1px solid #ddd}
.bd-old .nav-tabs::after{content:"";display:table;clear:both}
.bd-old .nav-tabs>li{float:left;margin-bottom:-1px;list-style:none}
.bd-old .nav-tabs>li>a{position:relative;display:block;margin-right:2px;line-height:1.42857143;border:1px solid transparent;border-radius:4px 4px 0 0;padding:10px 15px;color:#337ab7;text-decoration:none}
.bd-old .nav-tabs>li>a:hover{background-color:#eee;border-color:#eee #eee #ddd}
.bd-old .nav-tabs>li.active>a,.bd-old .nav-tabs>li.active>a:hover{color:#555;cursor:default;background-color:#fff;border:1px solid #ddd;border-bottom-color:transparent}
.bd-old #tabs{background:beige}
.bd-old .form-control{display:block;width:100%;height:34px;padding:6px 12px;font-size:14px;line-height:1.42857143;color:#555;background-color:#fff;background-image:none;border:1px solid #ccc;border-radius:4px;box-shadow:inset 0 1px 1px rgba(0,0,0,.075);transition:border-color ease-in-out .15s,box-shadow ease-in-out .15s}
.bd-old .form-control:focus{border-color:#66afe9;outline:0;box-shadow:inset 0 1px 1px rgba(0,0,0,.075),0 0 8px rgba(102,175,233,.6)}
.bd-old select.form-control[multiple]{height:70px}
.bd-old .btn{display:inline-block;padding:6px 12px;margin-bottom:0;font-size:14px;font-weight:400;line-height:1.42857143;text-align:center;white-space:nowrap;vertical-align:middle;cursor:pointer;background-image:none;border:1px solid transparent;border-radius:4px;text-decoration:none}
.bd-old .btn-primary{color:#fff;background-color:#337ab7;border-color:#2e6da4}
.bd-old .btn-primary:hover,.bd-old .btn-primary:focus{background-color:#286090;border-color:#204d74}
.bd-old .btn-danger{color:#fff;background-color:#d9534f;border-color:#d43f3a}
.bd-old .btn-danger:hover,.bd-old .btn-danger:focus{background-color:#c9302c;border-color:#ac2925}
.bd-old .btn-sm{padding:5px 10px;font-size:12px;line-height:1.5;border-radius:3px}
.bd-old .table{width:100%;max-width:100%;margin-bottom:20px;border-collapse:collapse;background-color:#fff}
.bd-old .table>thead>tr>th{background:#006699;color:#fff;font-weight:bold;text-transform:uppercase;padding:8px;border:1px solid #ddd;text-align:left;font-size:x-small}
.bd-old .table>tbody>tr>td{padding:8px;color:#333333;border-top:1px solid #ddd;font-size:x-small}
.bd-old .table>tbody>tr.selected>td{background:#669999;color:#fff;font-weight:bold}
.bd-old .grid-view{max-height:500px;height:auto;overflow-y:auto;overflow-x:hidden}
.bd-old .table-responsive{min-height:.01;overflow-x:auto}
.bd-old .fld{margin-bottom:8px}
.bd-old .fld-label{display:block;min-height:12px;line-height:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:9px}
.bd-old .field-control{margin-top:0}
`;

/* specs ko 12-unit (bootstrap) rows me baanto taaki har line seedhi aaye */
const chunk12 = (specs: Spec[]): Spec[][] => {
  const out: Spec[][] = []; let cur: Spec[] = []; let sum = 0;
  for (const s of specs) {
    const w = s.w ?? 2;
    if (cur.length && sum + w > 12) { out.push(cur); cur = []; sum = 0; }
    cur.push(s); sum += w;
  }
  if (cur.length) out.push(cur);
  return out;
};

export default function BillingDetailsPage() {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>(defaults());
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [desigRows, setDesigRows] = useState<DesigRow[]>([]);
  const [unitsAll, setUnitsAll] = useState<UnitOpt[]>([]);
  const [unitsHaving, setUnitsHaving] = useState<UnitOpt[]>([]);
  const [unitsNotHaving, setUnitsNotHaving] = useState<UnitOpt[]>([]);
  const [rows, setRows] = useState<GridRow[]>([]);
  const [gridQuery, setGridQuery] = useState("");
  const [selUnitsHaving, setSelUnitsHaving] = useState<string[]>([]);
  const [selUnitsNotHaving, setSelUnitsNotHaving] = useState<string[]>([]);
  const [selDesig, setSelDesig] = useState<string[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const [applyAllBranches, setApplyAllBranches] = useState(true);
  const [machineRows, setMachineRows] = useState<MachineRow[]>([]);
  const [materialRows, setMaterialRows] = useState<{ id: number; material_name: string; rate: string; handling_charges_amount: string; handling_percent: string }[]>([]);
  const [machines, setMachines] = useState<MachineOpt[]>([]);
  const [msg, setMsg] = useState("");
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("home");

  // The Salary tab's Other Allowances is typed by hand: once it is touched (or a saved policy is opened) the State amount
  // no longer overwrites it, and it never changes the Billing tab's Other Allowances.
  const salAllowTouched = useRef(false);
  // A saved policy whose State Allowance is "Not Applicable" (e.g. Zomato: the Other Allowances differ by designation, they are not a State amount)
  // shows the amounts that are saved in it, in both tabs, until the user changes the State Allowance box himself.
  const keepStoredAllow = useRef(false);
  const set = (k: string, v: string) => {
    if (k === "ddl_state_allowance") keepStoredAllow.current = false;
    if (k === "txt_allowances_salary") salAllowTouched.current = true;
    setForm((p) => ({ ...p, [k]: v }));
  };
  /* legacy BillingDetails.aspx taxable onchange handlers (bonus/gratuity/leave, billing <-> salary):
     auto-rewrite the paired salary option / percent fields and raise the exact legacy alerts */
  const [roMap, setRoMap] = useState<Record<string, boolean>>({});
  const [disMap, setDisMap] = useState<Record<string, boolean>>({});
  const TAXABLE_IDS = new Set(["ddl_bonus_taxable_billing", "ddl_bonus_taxable_salary",
    "ddl_gratuity_taxable_billing", "ddl_gratuity_taxable_salary",
    "ddl_leave_taxable_billing", "ddl_leave_taxable_salary"]);
  const taxableChange = (id: string, v: string) => {
    const f: Record<string, string> = { ...form, [id]: v };
    const ro: Record<string, boolean> = { ...roMap };
    const dis: Record<string, boolean> = { ...disMap };
    const txt = (cid: string) => (ALL.find((x) => x.id === cid)?.opts ?? []).find((o) => o[0] === f[cid])?.[1] ?? "";
    const NA_MSG = (w: string) => `In Billing ${w} Policy is Not Applicable, Select Not Applicable / Advance Policy.`;

    const bonusSalary = () => {
      const t = txt("ddl_bonus_taxable_salary"), b = txt("ddl_bonus_taxable_billing");
      f.txt_sal_bonus = "8.33"; ro.txt_sal_bonus = false;
      const na = () => { alert(NA_MSG("Bonus")); f.ddl_bonus_taxable_salary = "2"; f.txt_sal_bonus = "0"; ro.txt_sal_bonus = true; };
      if (t === "Not Applicable") { f.txt_sal_bonus = "0"; ro.txt_sal_bonus = true; }
      else if (t === "Advance Policy") alert("In Advance Policy Bonus Amount will not be Taxable.");
      else if (t === "No") {
        if (b === "Yes" || b === "Yearly") alert("In Billing Bonus Amount is Taxable.");
        if (b === "Not Applicable") na();
      } else if (t === "Yes" || t === "Yearly") {
        if (b === "No") alert("In Billing Bonus Amount is Not Taxable.");
        if (b === "Not Applicable") na();
      }
    };
    const bonusBilling = () => {
      const t = txt("ddl_bonus_taxable_billing");
      ro.txt_bill_bonus_percent = false;
      if (t === "Not Applicable") {
        f.txt_bill_bonus_percent = "0"; ro.txt_bill_bonus_percent = true;
        dis.ddl_bonus_taxable_salary = true; f.ddl_bonus_taxable_salary = "2"; bonusSalary();
      } else if (t === "No" || t === "Yes" || t === "Yearly") {
        f.ddl_bonus_taxable_salary = t === "No" ? "0" : t === "Yes" ? "1" : "4";
        dis.ddl_bonus_taxable_salary = false; bonusSalary();
      }
    };
    const gratSalary = () => {
      const t = txt("ddl_gratuity_taxable_salary"), b = txt("ddl_gratuity_taxable_billing");
      f.txt_sal_graguity_per = "4.81"; ro.txt_sal_graguity_per = false;
      if (t === "Not Applicable") { f.txt_sal_graguity_per = "0"; ro.txt_sal_graguity_per = true; }
      else if (t === "No") { if (b === "Yes") alert("In Billing Gratuity is Taxable."); }
      else if (t === "Yes" || t === "Yearly") {
        if (b === "No") alert("In Billing Gratuity is Not Taxable.");
        if (b === "Not Applicable") dis.ddl_gratuity_taxable_salary = true;
      }
    };
    const gratBilling = () => {
      const t = txt("ddl_gratuity_taxable_billing");
      if (t === "Not Applicable") {
        f.txt_gratuity_percent_billing = "0"; ro.txt_gratuity_percent_billing = true;
        f.ddl_gratuity_taxable_salary = "2"; dis.ddl_gratuity_taxable_salary = true; gratSalary();
      } else if (t === "No" || t === "Yes" || t === "Yearly") {
        f.txt_gratuity_percent_billing = "4.81"; ro.txt_gratuity_percent_billing = false;
        f.ddl_gratuity_taxable_salary = t === "No" ? "0" : t === "Yes" ? "1" : "3";
        dis.ddl_gratuity_taxable_salary = false; gratSalary();
      }
    };
    const leaveSalary = () => {
      const t = txt("ddl_leave_taxable_salary"), b = txt("ddl_leave_taxable_billing");
      ro.txt_leave_days_percent_salary = false; ro.txt_leave_days_salary = false;
      const zero = () => { f.txt_leave_days_percent_salary = "0"; ro.txt_leave_days_percent_salary = true;
        f.txt_leave_days_salary = "0"; ro.txt_leave_days_salary = true; };
      const na = () => { alert(NA_MSG("Leave")); f.ddl_leave_taxable_salary = "2"; zero(); };
      if (t === "Not Applicable") zero();
      else if (t === "Advance Policy") alert("In Advance Policy Leave Amount will not be Taxable.");
      else if (t === "No") {
        if (b === "Yes" || b === "Yearly") alert("In Billing Leave Amount is Taxable.");
        if (b === "Not Applicable") na();
      } else if (t === "Yes" || b === "Yearly") {
        if (b === "No") alert("In Billing Leave Amount is Not Taxable.");
        if (b === "Not Applicable") na();
      }
    };
    const leaveBilling = () => {
      const t = txt("ddl_leave_taxable_billing");
      ro.txt_leave_days_percent = false; ro.txt_leave_days = false;
      if (t === "Not Applicable") {
        f.txt_leave_days_percent = "0"; ro.txt_leave_days_percent = true;
        f.txt_leave_days = "0"; dis.txt_leave_days = true;
        dis.ddl_leave_taxable_salary = true; f.ddl_leave_taxable_salary = "2"; leaveSalary();
      } else if (t === "No" || t === "Yes" || t === "Yearly") {
        f.ddl_leave_taxable_salary = t === "No" ? "0" : t === "Yes" ? "1" : "4";
        f.txt_leave_days = "0"; dis.txt_leave_days = false; dis.ddl_leave_taxable_salary = false; leaveSalary();
      }
    };
    if (id === "ddl_bonus_taxable_billing") bonusBilling();
    else if (id === "ddl_bonus_taxable_salary") bonusSalary();
    else if (id === "ddl_gratuity_taxable_billing") gratBilling();
    else if (id === "ddl_gratuity_taxable_salary") gratSalary();
    else if (id === "ddl_leave_taxable_billing") leaveBilling();
    else if (id === "ddl_leave_taxable_salary") leaveSalary();
    setForm(f); setRoMap(ro); setDisMap(dis);
  };
  const multi = (e: React.ChangeEvent<HTMLSelectElement>) =>
    [...e.target.selectedOptions].map((o) => o.value);

  const loadGrid = useCallback(async (clientCode?: string) => {
    // Backend paginates (25/page, `limit` unsupported) — saare pages lao taaki
    // grid + Excel me poori policy list aaye, sirf pehla page nahi. (DB me jo hai
    // wo sab dikhega.)
    const filt = clientCode && clientCode !== "Select"
      ? `billing_client_code=${encodeURIComponent(clientCode)}&`
      : "";
    const all: GridRow[] = [];
    for (let page = 1; page <= 10; page++) {
      const d = await getJSON<{ results: GridRow[]; next?: string | null } | GridRow[]>(
        `${PM()}?${filt}page=${page}&page_size=all`);
      if (!d) break;
      const list = (Array.isArray(d) ? d : d?.results ?? []) as GridRow[];
      all.push(...list);
      if (Array.isArray(d) || !d.next || list.length === 0) break;
    }
    setRows(all);
  }, []);

  useEffect(() => {
    (async () => {
      const d = await getJSON<{ results: ClientOpt[] } | ClientOpt[]>("/api/masters/clients/?page_size=all");
      /* client_list(): only ACTIVE clients (client_active_close = '0') */
      const list = ((Array.isArray(d) ? d : (d as { results: ClientOpt[] })?.results ?? []) as ClientOpt[])
        .filter((c) => String(c.client_active_close ?? "0") === "0");
      /* pf_account_details()/pf_account_details1(): PF percents come from pay_company_pf_details */
      const pf = await getJSON<{ employer: number | null; employee: number | null }>("/api/payroll/billing-master/pf-percent/");
      if (pf) {
        if (pf.employer != null) PF_DEFAULT.employer = String(pf.employer);
        if (pf.employee != null) PF_DEFAULT.employee = String(pf.employee);
        setForm((p) => ({
          ...p,
          ...(pf.employer != null ? { txt_bill_pf_percent: String(pf.employer) } : {}),
          ...(pf.employee != null ? { txt_sal_pf: String(pf.employee) } : {}),
        }));
      }
      if (!list.length) setLoadError("The Client dropdown is empty — no clients returned from /api/masters/clients/. Log in and check the data in Client Master first.");
      setClients(list);
      loadGrid();
      /* legacy Machine_list(): select ITEM_code,ITEM_NAME from pay_item_master
       * where product_service='Machine' */
      const md = await getJSON<{ results: MachineOpt[] } | MachineOpt[]>(
        "/api/masters/item-masters/?product_service=Machine&page_size=all");
      setMachines((Array.isArray(md) ? md : (md as { results: MachineOpt[] })?.results ?? []) as MachineOpt[]);
    })();
  }, [loadGrid]);

  /* ddl_clientname_SelectedIndexChanged */
  useEffect(() => {
    const cc = form.ddl_unit_client;
    if (!cc || cc === "Select") {
      setDesigRows([]); setUnitsAll([]); setUnitsHaving([]); setUnitsNotHaving([]);
      setSelUnitsHaving([]); setSelUnitsNotHaving([]); setSelDesig([]);
      return;
    }
    (async () => {
      const dr = await getJSON<{ results: DesigRow[] }>(
        `/api/masters/client-designation-counts/lookup/?client_code=${encodeURIComponent(cc)}`);
      setDesigRows(dr?.results ?? []);
      const u = await getJSON<{ units: UnitOpt[] }>(
        `/api/masters/units/lookup/?client_code=${encodeURIComponent(cc)}`);
      const all = u?.units ?? [];
      setUnitsAll(all);
      const pm = await getJSON<{ results: GridRow[] } | GridRow[]>(
        `${PM()}?billing_client_code=${encodeURIComponent(cc)}&page_size=all`);
      const plist = (Array.isArray(pm) ? pm : (pm as { results: GridRow[] })?.results ?? []) as GridRow[];
      const having = new Set(plist.map((r) => String(r.billing_unit_code ?? "")).filter(Boolean));
      setUnitsHaving(all.filter((x) => having.has(x.unit_code)));
      setUnitsNotHaving(all.filter((x) => !having.has(x.unit_code)));
      setForm((p) => ({
        ...p, ddl_clientwisestate: "Select", ddl_category: "Select",
        txt_start_date: "", txt_end_date: ""
      }));
      setSelUnitsHaving([]); setSelUnitsNotHaving([]); setSelDesig([]);
      loadGrid(cc);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.ddl_unit_client]);

  /* legacy billing_dates(): Billing Start Day + Billing End Day auto-fill from the
     selected client's billing cycle (pay_client_master.start_date_billing /
     end_date_billing -> modern Client.billing_start_day / billing_end_day). */
  useEffect(() => {
    const cc = form.ddl_unit_client;
    if (!cc || cc === "Select") return;
    const c = clients.find((x) => x.client_code === cc);
    if (!c) return;
    /* legacy ddl_clientname_SelectedIndexChanged: no billing cycle on the client -> alert + reset */
    if (c.billing_start_day == null || String(c.billing_start_day).trim() === "") {
      if (selId != null) return; /* editing a saved policy via grid row select: legacy does not re-run the client handler */
      alert("Please Set Billing Cycle in Client Master !!");
      setForm((p) => ({ ...p, ddl_unit_client: "Select", txt_start_date_common: "0", txt_end_date_common: "" }));
      return;
    }
    const sd = String(c.billing_start_day);
    const ed = c.billing_end_day != null ? String(c.billing_end_day) : "";
    setForm((p) => {
      if (p.txt_start_date_common === sd && p.txt_end_date_common === ed) return p;
      return { ...p, txt_start_date_common: sd, txt_end_date_common: ed };
    });
  }, [form.ddl_unit_client, clients]);

  // Search box above the policy grid: matches policy, client, branch (code or name), state, designation, hours, dates, id.
  // The Excel / CSV buttons download exactly the rows that are shown.
  const shownRows = useMemo(() => {
    const q = gridQuery.trim().toLowerCase();
    if (!q) return rows;
    const unitName = new Map(unitsAll.map((u) => [u.unit_code, u.unit_name ?? ""]));
    return rows.filter((r) => [r.id, r.policy_name1, r.billing_client_code, r.billing_unit_code,
      unitName.get(String(r.billing_unit_code ?? "")), r.billing_state, r.designation, r.hours, r.start_date, r.end_date]
      .map((v) => String(v ?? "").toLowerCase()).join(" ").includes(q));
  }, [rows, gridQuery, unitsAll]);

  const states = useMemo(() => {
    const s = new Set<string>();
    desigRows.forEach((r) => { if (r.state) s.add(r.state); });
    unitsAll.forEach((u) => { if (u.state_name) s.add(u.state_name); });
    return [...s].sort();
  }, [desigRows, unitsAll]);

  /* ddl_clientwisestate_SelectedIndexChanged: branches re-split within state */
  const stateUnitsHaving = useMemo(() => {
    if (form.ddl_clientwisestate === "Select") return unitsHaving;
    return unitsHaving.filter((u) => u.state_name === form.ddl_clientwisestate);
  }, [unitsHaving, form.ddl_clientwisestate]);
  const stateUnitsNotHaving = useMemo(() => {
    if (form.ddl_clientwisestate === "Select") return unitsNotHaving;
    const inState = unitsAll.filter((u) => u.state_name === form.ddl_clientwisestate);
    const havingCodes = new Set(unitsHaving.map((u) => u.unit_code));
    const base = inState.length ? inState : unitsNotHaving;
    return base.filter((u) => !havingCodes.has(u.unit_code));
  }, [unitsNotHaving, unitsAll, unitsHaving, form.ddl_clientwisestate]);

  const activeUnitCodes = useMemo(() => {
    const s = [...selUnitsHaving, ...selUnitsNotHaving];
    return s.length ? s : unitsAll.map((u) => u.unit_code);
  }, [selUnitsHaving, selUnitsNotHaving, unitsAll]);

  /* display_category + ddl_unitcode_SelectedIndexChanged */
  const categories = useMemo(() => {
    const s = new Set<string>();
    desigRows.forEach((r) => {
      if (form.ddl_clientwisestate !== "Select" && r.state !== form.ddl_clientwisestate) return;
      if (r.unit_code && activeUnitCodes.length && !activeUnitCodes.includes(r.unit_code)) return;
      if (r.category) s.add(r.category);
    });
    return [...s].sort();
  }, [desigRows, form.ddl_clientwisestate, activeUnitCodes]);

  /* Fetch State-wise Other Allowances from Backend */
  const [stateAllowances, setStateAllowances] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      try {
        const data = await getJSON<any>("/api/masters/state-allowance/");
        const mapping: Record<string, string> = {};
        const rows = Array.isArray(data) ? data : (data?.results || []);
        rows.forEach((row: any) => {
          if (row.state_name) {
            mapping[row.state_name] = String(row.allowance_amount);
          }
        });
        setStateAllowances(mapping);
      } catch (err) {
        console.error("Failed to load state allowances", err);
      }
    })();
  }, []);

  /* State-wise Other Allowance auto-fill */
  useEffect(() => {
    const stateName = form.ddl_clientwisestate;
    if (!stateName || stateName === "Select") return;

    const notApplicable = form.ddl_state_allowance === "0";
    const apply = (amt0: string) => setForm((p) => {
      if (notApplicable && keepStoredAllow.current) return p;       // saved policy: keep the Other Allowances that are stored in it
      const amt = notApplicable ? "0" : amt0;                      // State Allowance : Not Applicable -> no State amount in either tab
      const sal = salAllowTouched.current && !notApplicable ? p.txt_allowances_salary : amt;
      if (p.txt_allowances_billing === amt && p.txt_allowances_salary === sal) return p;
      return { ...p, txt_allowances_billing: amt, txt_allowances_salary: sal };
    });
    apply(stateAllowances[stateName] || "0");
    // re-read the table when a State is picked, so an amount saved after this page was opened shows without a reload
    (async () => {
      try {
        const data = await getJSON<any>("/api/masters/state-allowance/");
        const rows = Array.isArray(data) ? data : (data?.results || []);
        const hit = rows.find((r: any) => r.state_name === stateName);
        if (hit) apply(String(hit.allowance_amount));
      } catch { /* keep the value already shown */ }
    })();
  }, [form.ddl_clientwisestate, stateAllowances, form.ddl_state_allowance]);

  const designations = useMemo(() => {
    const s = new Set<string>();
    desigRows.forEach((r) => {
      if (form.ddl_clientwisestate !== "Select" && r.state && r.state !== form.ddl_clientwisestate) return;
      if (form.ddl_category !== "Select" && r.category && r.category !== form.ddl_category) return;
      if (r.unit_code && activeUnitCodes.length && !activeUnitCodes.includes(r.unit_code)) return;
      if (r.designation) s.add(r.designation);
    });
    return [...s].sort();
  }, [desigRows, form.ddl_clientwisestate, form.ddl_category, activeUnitCodes]);

  /* ddl_designation_SelectedIndexChanged -> hours */
  const hoursList = useMemo(() => {
    const s = new Set<string>();
    desigRows.forEach((r) => {
      if (selDesig.length && !selDesig.includes(r.designation)) return;
      if (r.hours) s.add(String(r.hours));
    });
    return [...s].sort();
  }, [desigRows, selDesig]);

  /* legacy agreement_date(): Start Date / End Date are read-only and auto-fill from the
     client designation (pay_designation_count.unit_start_date / unit_end_date) for the
     selected state + designation. Only set when the designation row actually carries dates
     (legacy SQL requires unit_start_date/unit_end_date NOT NULL), so an edit-loaded policy's
     dates are never cleared. */
  useEffect(() => {
    const st = form.ddl_clientwisestate;
    // Prefer the selected designation's dated row; before any designation is picked,
    // fall back to the first dated row for the client (+ selected state) so the dates
    // appear as soon as the client is chosen.
    const match = desigRows.find((r) =>
      (!st || st === "Select" || r.state === st) &&
      (selDesig.length === 0 || selDesig.includes(r.designation)) &&
      (r.start_date || r.end_date));
    if (!match) return;
    setForm((p) => {
      const s = match.start_date ?? p.txt_start_date;
      const e = match.end_date ?? p.txt_end_date;
      if (p.txt_start_date === s && p.txt_end_date === e) return p;
      return { ...p, txt_start_date: s, txt_end_date: e };
    });
  }, [desigRows, selDesig, form.ddl_clientwisestate]);

  /* add_number(): Basic+VDA auto */
  useEffect(() => {
    const b = parseFloat(form.txt_basic_billing || "0") || 0;
    const v = parseFloat(form.txt_vda_billing || "0") || 0;
    const tot = String(Math.round((b + v) * 100) / 100);
    if (form.txt_basic_vda_billing !== tot) setForm((p) => ({ ...p, txt_basic_vda_billing: tot }));
    const sb = parseFloat(form.txt_basic_salary || "0") || 0;
    const sv = parseFloat(form.txt_vda_salary || "0") || 0;
    const stot = String(Math.round((sb + sv) * 100) / 100);
    if (form.txt_basic_vda_salary !== stot) setForm((p) => ({ ...p, txt_basic_vda_salary: stot }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.txt_basic_billing, form.txt_vda_billing, form.txt_basic_salary, form.txt_vda_salary]);

  /* ---- exact old Req_validation() (Save button): same order + messages ---- */
  const optText = (id: string): string => {
    const spec = ALL.find((s) => s.id === id);
    const v = form[id] ?? "";
    const hit = spec?.opts?.find(([val]) => val === v);
    return hit ? hit[1] : v;
  };
  const isZero = (v: string | undefined): boolean =>
    v === undefined || v === "" || Number(v) === 0;

  /* legacy onblur rules: these percent fields must stay within 0..100 */
  const PCT_IDS = ["txt_hra_percent", "txt_hra_percent_salary", "txt_leave_days_percent",
    "txt_leave_days_percent_salary", "txt_bill_uniform_percent", "txt_sal_uniform_percent",
    "txt_bill_oper_cost_percent", "txt_bill_bonus_percent", "txt_bill_pf_percent",
    "txt_bill_esic_percent", "txt_bill_relieving", "txt_bill_service_charge", "txt_sal_bonus",
    "txt_sal_pf", "txt_sal_esic", "txt_conveyance_service_charge"];

  const reqValidation = (): boolean => {
    for (const id of PCT_IDS) {
      const raw = form[id];
      if (raw === undefined || raw === "") continue;
      const v = Number(raw);
      if (v < 0 || v > 100) { alert("Please Enter Less Than Hundred"); return false; }
    }
    if (form.ddl_unit_client === "Select") { alert("Please Select Client Name !!!"); return false; }
    if (form.ddl_clientwisestate === "Select") { alert("Please Select State !!!"); return false; }
    if (form.ddl_policy === "2" && selUnitsHaving.length === 0 && selUnitsNotHaving.length === 0) {
      alert("Please Select atleast One Branch Name !!!"); return false;
    }
    if (!form.txt_policy_name1.trim()) { alert("Please Enter Policy Name"); return false; }
    if (selDesig.length === 0) { alert("Please Select Atleast One Designation."); return false; }
    if (!form.ddl_hours) { alert("Please Select Duty Hours"); return false; }
    if (optText("ddl_month_calc") === "Select") { alert("Please Select Month Calculation"); return false; }
    const bonusTx = optText("ddl_bonus_taxable_billing");
    if ((bonusTx === "No" || bonusTx === "Yes" || bonusTx === "Yearly") && isZero(form.txt_bill_bonus_percent)) {
      alert("Billing Bonus Percent should be Greater than zero"); return false;
    }
    const gratTx = optText("ddl_gratuity_taxable_billing");
    if ((gratTx === "No" || gratTx === "Yes" || gratTx === "Yearly") && isZero(form.txt_gratuity_percent_billing)) {
      alert("Billing Gratuity Percent value should be greater than zero"); return false;
    }
    const leaveTx = optText("ddl_leave_taxable_billing");
    if ((leaveTx === "No" || leaveTx === "Yes" || leaveTx === "Yearly")
      && isZero(form.txt_leave_days_percent) && isZero(form.txt_leave_days)) {
      alert("Please add Billing leave percent/leave days"); return false;
    }
    const sBonusTx = optText("ddl_bonus_taxable_salary");
    if ((sBonusTx === "No" || sBonusTx === "Yes" || sBonusTx === "Yearly") && isZero(form.txt_sal_bonus)) {
      alert("Salary Bonus percent should be greater than zero"); return false;
    }
    /* NOTE: legacy checks salary gratuity only for No/Yes — Yearly skips (asymmetry preserved) */
    const sGratTx = optText("ddl_gratuity_taxable_salary");
    if ((sGratTx === "No" || sGratTx === "Yes") && isZero(form.txt_sal_graguity_per)) {
      alert("Salary gratuity percent should be greater than zero"); return false;
    }
    const sLeaveTx = optText("ddl_leave_taxable_salary");
    if ((sLeaveTx === "No" || sLeaveTx === "Yes" || sLeaveTx === "Yearly")
      && isZero(form.txt_leave_days_percent_salary) && isZero(form.txt_leave_days_salary)) {
      alert("Please add Salary leave percent/leave days"); return false;
    }
    if (optText("ddl_med_insurance_applicable") === "Applicable" && isZero(form.txt_medical_insurance)) {
      alert("Please add Medical Insurance Amount"); return false;
    }
    return true;
  };

  /* ---- exact old Req_validation1() (Assign Policy button): shorter, no policy-name/percent checks ---- */
  const reqValidation1 = (): boolean => {
    if (form.ddl_unit_client === "Select") { alert("Please Select Client Name !!!"); return false; }
    if (form.ddl_clientwisestate === "Select") { alert("Please Select State !!!"); return false; }
    if (form.ddl_policy === "2" && selUnitsHaving.length === 0 && selUnitsNotHaving.length === 0) {
      alert("Please Select atleast One Branch Name !!!"); return false;
    }
    if (selDesig.length === 0) { alert("Please Select Atleast One Designation."); return false; }
    return true;
  };

  const buildBody = (unitCode: string, desig: string): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      billing_client_code: form.ddl_unit_client,
      billing_state: form.ddl_clientwisestate === "Select" ? "" : form.ddl_clientwisestate,
      billing_unit_code: unitCode,
      designation: desig,
      hours: form.ddl_hours || "",
      month_calc: form.ddl_month_calc || "",
      policy_name1: form.txt_policy_name1.trim(),
      start_date: form.txt_start_date || null,
      end_date: form.txt_end_date || null,
      category: form.ddl_category === "Select" ? "" : form.ddl_category,
    };
    for (const s of ALL) {
      if (!s.model || s.top) continue;
      if (["designation", "hours", "month_calc", "policy_name1", "start_date", "end_date", "category"].includes(s.model)) continue;
      const v = form[s.id];
      if (v === undefined || v === "") continue;
      body[s.model] = v;
    }
    /* legacy btnadd_Click -> add(unit, designation, id): staged machine rows
     * ride each policy POST; the server applies the HK/BLC gate + persists.
     * all_designations preserves the ordered multi-selection for the
     * control-level gate (legacy ddl_designation.SelectedValue). */
    if (machineRows.length) {
      body.machine_rows = machineRows.map((m) => ({
        policy_machine_nane: m.machineName, policy_rate_type: m.rateType,
        policy_m_rate: m.amount, policy_m_h_charges: m.hc,
        policy_in_pre: m.inPer, policy_m_amount: m.inAmt,
        machine_code: m.machineCode, no_machine_qty: m.qty,
        admin_cost: m.admin, technical_tools: m.tools,
      }));
      body.all_designations = selDesig;
    }
    return body;
  };

  /* re-split the branches into "Having / Not Having Policy" after a save, assign or delete */
  const refreshUnits = async (cc: string) => {
    if (!cc || cc === "Select") return;
    try {
      const pm = await getJSON<{ results: GridRow[] } | GridRow[]>(
        `${PM()}?billing_client_code=${encodeURIComponent(cc)}&page_size=all`);
      const plist = (Array.isArray(pm) ? pm : (pm as { results: GridRow[] })?.results ?? []) as GridRow[];
      const have = new Set(plist.map((r) => String(r.billing_unit_code ?? "")).filter(Boolean));
      setUnitsHaving(unitsAll.filter((x) => have.has(x.unit_code)));
      setUnitsNotHaving(unitsAll.filter((x) => !have.has(x.unit_code)));
      setSelUnitsHaving([]); setSelUnitsNotHaving([]);
    } catch { /* ignore */ }
  };

  const doSave = async (): Promise<boolean> => {
    if (!reqValidation()) return false;
    /* Row select karke Save = UPDATE (VDA wagera usi row me badlega).
       Bina select ke Save = legacy jaisa naya policy insert. */
    if (selId != null) {
      const orig = rows.find((r) => r.id === selId);
      if (!orig) { alert("Record not Available"); return false; }
      const body = buildBody(
        String(orig.billing_unit_code ?? ""),
        selDesig.length ? selDesig[0] : String(orig.designation ?? ""));
      const r = await putJSON(`${PM()}${selId}/`, { ...body, apply_all_branches: applyAllBranches });
      if (r.ok) {
        setMsg(`Policy Updated Successfully (ID ${selId})`);
        alert(`Policy Updated Successfully (ID ${selId})`);
        // Server se fresh row lao aur form me dikhao — taaki field me saved
        // value aaye, purani stale value nahi.
        const fresh = await getJSON<GridRow>(`${PM()}${selId}/`);
        if (fresh && !Array.isArray(fresh)) fillForm(fresh);
        loadGrid(form.ddl_unit_client); return true;
      }
      let fail = "";
      try { const b = await r.json(); fail = typeof b === "object" ? JSON.stringify(b) : String(b); }
      catch { fail = `HTTP ${r.status}`; }
      const failMsg = (fail || "Policy Update Failed... !!!").replace(/["[\]{}]/g, "");
      setMsg(failMsg); alert(failMsg); return false;
    }
    /* legacy btnadd_Click: billing-cycle guard — existing start_date_common wins */
    const sc = rows.length ? String(rows[0].start_date_common ?? "") : "";
    if (sc && sc !== form.txt_start_date_common) {
      alert(`Start date is ${sc}`);
      return false;
    }
    // purane jaisa: Statewise par branch selection ignore, Branchwise par selected branches
    let units = form.ddl_policy === "2" ? [...selUnitsHaving, ...selUnitsNotHaving] : [];
    // legacy: ticking ALL in "Branch Not Having Policy" means every branch of that state that has no policy yet
    if (units.includes("ALL")) {
      units = Array.from(new Set([...units.filter((x) => x !== "ALL"), ...stateUnitsNotHaving.map((u) => u.unit_code)]));
    }
    const unitList = units.length ? units : ["ALL"];
    let ok = 0; let fail = "";
    for (const u of unitList) {
      for (const d of selDesig) {
        const r = await mk(PM(), buildBody(u, d));
        if (r.ok) ok++;
        else { try { const b = await r.json(); fail = typeof b === "object" ? JSON.stringify(b) : String(b); } catch { fail = `HTTP ${r.status}`; } }
      }
    }
    if (ok) {
      setMsg("Policy Added Successfully");
      alert("Policy Added Successfully");
      /* legacy btnadd_Click end: gv_product_details + grd_material_detail cleared */
      setMachineRows([]);
      loadGrid(form.ddl_unit_client);
      await refreshUnits(form.ddl_unit_client);
      return true;
    }
    const failMsg = (fail || "Record Added Failed... !!!").replace(/["[\]{}]/g, "");
    setMsg(failMsg); alert(failMsg); return false;
  };

  /* ---- exact old btn_assign_Click: clone the EXISTING policy onto new branches ---- */
  const doAssign = async (): Promise<boolean> => {
    if (!reqValidation1()) return false;
    const units = [...selUnitsHaving, ...selUnitsNotHaving];
    if (!units.length) { alert("Please Select atleast One Branch Name !!!"); return false; }
    for (const d of selDesig) {
      const r = await mk(`${PM()}assign/`, {
        billing_client_code: form.ddl_unit_client,
        billing_state: form.ddl_clientwisestate === "Select" ? "" : form.ddl_clientwisestate,
        designation: d,
        hours: form.ddl_hours || "",
        category: form.ddl_category === "Select" ? "" : form.ddl_category,
        billing_unit_codes: units,
      });
      if (r.ok) continue;
      let msg = "";
      try { const b = await r.json(); msg = typeof b === "object" ? JSON.stringify(b) : String(b); }
      catch { msg = `HTTP ${r.status}`; }
      alert(msg.replace(/["[\]{}]/g, ""));
      return false;
    }
    setMsg("Policy Assign Successfully"); alert("Policy Assign Successfully");
    loadGrid(form.ddl_unit_client);
    await refreshUnits(form.ddl_unit_client);
    return true;
  };

  const onDelete = async () => {
    if (selId == null) { alert("Record not Available"); return; }
    const r = confirm("Are you Sure You Want to Delete Record");
    if (!r) { alert("Record not Available"); return; }
    const resp = await deleteItem(PM(), selId);
    if (resp.ok) { setMsg("Policy Deleted Successfully"); alert("Policy Deleted Successfully"); setSelId(null); loadGrid(form.ddl_unit_client); void refreshUnits(form.ddl_unit_client); }
    else { setMsg("Record not Available"); alert("Record not Available"); }
  };

  const fillForm = (row: GridRow) => {
    setForm((p) => {
      const n = { ...p };
      for (const s of ALL) {
        if (!s.model) continue;
        const v = row[s.model];
        if (v !== undefined && v !== null) n[s.id] = String(v);
      }
      if (row.billing_client_code) n.ddl_unit_client = String(row.billing_client_code);
      if (row.billing_state) n.ddl_clientwisestate = String(row.billing_state);
      // Other Allowances is state-driven (read-only): a saved policy shows its State's amount, not the stored 0
      const stAmt = stateAllowances[String(row.billing_state ?? "")];
      if (stAmt !== undefined && Number(row.state_allowance_applicable ?? 1) !== 0) n.txt_allowances_billing = stAmt;    // billing stays State-driven; salary keeps what was saved
      salAllowTouched.current = true;
      keepStoredAllow.current = Number(row.state_allowance_applicable ?? 1) === 0;
      if (row.designation) setSelDesig([String(row.designation)]);
      if (row.hours) n.ddl_hours = String(row.hours);
      if (row.billing_unit_code) {
        const uc = String(row.billing_unit_code);
        if (unitsHaving.some((u) => u.unit_code === uc)) setSelUnitsHaving([uc]);
        else setSelUnitsNotHaving([uc]);
      }
      return n;
    });
  };

  const pickRow = async (row: GridRow) => {
    /* legacy grd_policy_SelectedIndexChanged: policy dropdown gates row select */
    if (form.ddl_policy === "0") { alert("Please Select Policy First..."); return; }
    setSelId(row.id);
    /* legacy :682 — reload staged machine rows by selected policy id */
    try {
      const md = await getJSON<{ results: Record<string, unknown>[] } | Record<string, unknown>[]>(
        `/api/payroll/machine-rental-details/?policy_id=${row.id}`);
      const list = (Array.isArray(md) ? md : (md as { results: Record<string, unknown>[] })?.results ?? []) as Record<string, unknown>[];
      setMachineRows(list.map((m) => ({
        machineCode: String(m.machine_code ?? ""), machineName: String(m.policy_machine_nane ?? ""),
        rateType: String(m.policy_rate_type ?? ""), amount: String(m.policy_m_rate ?? "0"),
        qty: String(m.no_machine_qty ?? "0"), admin: String(m.admin_cost ?? "0"),
        tools: String(m.technical_tools ?? "0"), hc: String(m.policy_m_h_charges ?? "No"),
        inPer: String(m.policy_in_pre ?? "0"), inAmt: String(m.policy_m_amount ?? "0"),
      })));
    } catch { setMachineRows([]); }
    fillForm(row);
  };

  /* Choosing ONE designation in the Designation list opens the saved policy of that designation (same as a click on its grid row):
     of the chosen State, and of the chosen Branch when one is selected. No saved policy -> the form stays as it is (a new policy). */
  const onDesigChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = multi(e);
    setSelDesig(v);
    if (v.length !== 1 || form.ddl_policy === "0") return;
    const st = form.ddl_clientwisestate;
    const units = [...selUnitsHaving, ...selUnitsNotHaving];
    const hits = rows.filter((r) => String(r.designation ?? "") === v[0]
      && (!st || st === "Select" || String(r.billing_state ?? "") === st));
    const row = hits.find((r) => units.includes(String(r.billing_unit_code ?? ""))) ?? (units.length ? undefined : hits[0]);
    if (row) pickRow(row);
  };

  /* ---- exact old machine_click_val() + "Machine Already Added!!" + clear_machine() ---- */
  /* ---- Material tab (legacy lnk_btn_Click -> pay_material_details; shown for 'Fix material') ---- */
  const loadMaterial = useCallback(async () => {
    const cc = form.ddl_unit_client;
    if (!cc || cc === "Select") { setMaterialRows([]); return; }
    const st = form.ddl_clientwisestate && form.ddl_clientwisestate !== "Select"
      ? `&state_name=${encodeURIComponent(form.ddl_clientwisestate)}` : "";
    const d = await getJSON<{ results: typeof materialRows } | typeof materialRows>(
      `/api/payroll/material-details/?client_code=${encodeURIComponent(cc)}${st}&page_size=all`);
    setMaterialRows((Array.isArray(d) ? d : d?.results ?? []) as typeof materialRows);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.ddl_unit_client, form.ddl_clientwisestate]);

  useEffect(() => { if (form.ddl_material_contract === "3") void loadMaterial(); }, [form.ddl_material_contract, loadMaterial]);

  const addMaterial = async () => {
    /* legacy save_validate2() */
    if (!form.txt_material_name.trim()) { alert("Please Enter Material name"); return; }
    if (isZero(form.txt_contract_rate)) { alert("Please Enter Material Contract Rate"); return; }
    if (optText("ddl_handling_charge") === "Yes" && isZero(form.txt_handling_percent) && isZero(form.txt_handling_amount)) {
      alert("Please Enter Material Contract Handling Charges Either Percentage"); return;
    }
    const r = await mk("/api/payroll/material-details/", {
      material_name: form.txt_material_name.trim(), rate: form.txt_contract_rate,
      handling_charges_amount: form.txt_handling_amount || "0", handling_percent: form.txt_handling_percent || "0",
      handling_applicable: form.ddl_handling_charge, client_code: form.ddl_unit_client,
      state_name: form.ddl_clientwisestate === "Select" ? "" : form.ddl_clientwisestate,
      unit_code: [...selUnitsHaving, ...selUnitsNotHaving][0] ?? "",
      new_policy_name: form.txt_policy_name1.trim(), start_date: form.txt_start_date || "",
      end_date: form.txt_end_date || "", designation: selDesig.join(","),
    });
    if (r.ok) {
      alert(" Material Successfully Added... !!!");
      setForm((p) => ({ ...p, txt_material_name: "", txt_contract_rate: "0", ddl_handling_charge: "0", txt_handling_percent: "0", txt_handling_amount: "0" }));
      await loadMaterial();
    } else {
      alert(" Material Addition Failed... !!!");
    }
  };

  const removeMaterial = async (id: number) => {
    const r = await rm(`/api/payroll/material-details/${id}/`);
    if (r.ok) await loadMaterial();
  };

  const addMachine = () => {
    if (!form.ddl_machine || form.ddl_machine === "Select") { alert("Please Select Machine Name"); return; }
    if (!form.ddl_rate_type || form.ddl_rate_type === "Select") { alert("Please Select Rate Type"); return; }
    if (!form.txt_machine_amount || form.txt_machine_amount === "0") {
      alert("Please Enter Amount");
      setForm((p) => ({ ...p, txt_machine_amount: "0" })); return;
    }
    if (!form.txt_machine_no_qty) {
      alert("Please Enter No Quantity");
      setForm((p) => ({ ...p, txt_machine_no_qty: "0" })); return;
    }
    if (!form.txt_machine_admin_cost) {
      alert("Please Enter Admin Cost");
      setForm((p) => ({ ...p, txt_machine_admin_cost: "0" })); return;
    }
    if (!form.txt_machine_tool_tackles) {
      alert("Please Enter Tools Tackles");
      setForm((p) => ({ ...p, txt_machine_tool_tackles: "0" })); return;
    }
    if (form.ddl_h_c_applicable === "Yes" && isZero(form.txt_in_per) && isZero(form.txt_in_amt)) {
      alert("Please Enter Percentage / Amount"); return;
    }
    /* legacy dup guard compares the machine CODE (Cells[8]) */
    if (machineRows.some((m) => m.machineCode === form.ddl_machine)) {
      alert("Machine Already Added!!"); return;
    }
    const mName = machines.find((x) => x.item_code === form.ddl_machine)?.item_name ?? form.ddl_machine;
    setMachineRows((p) => [...p, {
      machineCode: form.ddl_machine, machineName: mName, rateType: form.ddl_rate_type,
      amount: form.txt_machine_amount, qty: form.txt_machine_no_qty,
      admin: form.txt_machine_admin_cost, tools: form.txt_machine_tool_tackles,
      hc: form.ddl_h_c_applicable, inPer: form.txt_in_per, inAmt: form.txt_in_amt,
    }]);
    /* legacy clear_machine() */
    setForm((p) => ({
      ...p, ddl_machine: "Select", ddl_rate_type: "Select", txt_machine_amount: "0",
      ddl_h_c_applicable: "No", txt_in_per: "0", txt_in_amt: "0",
      txt_machine_no_qty: "0", txt_machine_admin_cost: "0", txt_machine_tool_tackles: "0",
    }));
  };

  /* ---- generic field renderer (old col-sm-2 grid, same labels) ---- */
  const renderSpec = (s: Spec) => {
    let ctrl: React.ReactNode = null;
    const cls = "form-control text_box";
    const style: React.CSSProperties = { width: "100%", height: "26px", fontSize: "9px", padding: "4px 10px" };
    /* legacy Page_Load/pf_account_details: PF percents come from pay_company_pf_details, ReadOnly */
    const READONLY_IDS = new Set(["txt_bill_pf_percent", "txt_sal_pf", "txt_allowances_billing"]);
    if (READONLY_IDS.has(s.id)) {
      ctrl = (<input className={cls} style={style} value={form[s.id]} readOnly />);
    } else if (s.id === "ddl_unit_client") {
      ctrl = (<select className={cls} style={style} value={form[s.id]} onChange={(e) => set(s.id, e.target.value)}>
        <option value="Select">Select</option>
        {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
      </select>);
    } else if (s.id === "ddl_clientwisestate") {
      ctrl = (<select className={cls} style={style} value={form[s.id]} onChange={(e) => set(s.id, e.target.value)}>
        <option value="Select">Select</option>
        {states.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>);
    } else if (s.id === "ddl_unitcode") {
      // Legacy plain multi-select ListBox: click SELECTS (stays highlighted),
      // rows never move between the two lists. Save/Assign read the selection.
      ctrl = (<select multiple className={cls} style={{ ...style, height: "56px" }} value={selUnitsHaving}
        onChange={(e) => setSelUnitsHaving(multi(e))}>
        {stateUnitsHaving.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_code} - {u.unit_name}</option>)}
      </select>);
    } else if (s.id === "ddl_unitcode_without") {
      ctrl = (<select multiple className={cls} style={{ ...style, height: "56px" }} value={selUnitsNotHaving}
        onChange={(e) => setSelUnitsNotHaving(multi(e))}>
        <option value="ALL">ALL</option>
        {stateUnitsNotHaving.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_code} - {u.unit_name}</option>)}
      </select>);
    } else if (s.id === "ddl_category") {
      ctrl = (<select className={cls} style={style} value={form[s.id]} onChange={(e) => set(s.id, e.target.value)}>
        <option value="Select">Select</option>
        {categories.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>);
    } else if (s.id === "ddl_designation") {
      ctrl = (<select multiple className={cls} style={{ ...style, height: "56px" }} value={selDesig} onChange={onDesigChange}>
        {designations.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>);
    } else if (s.id === "ddl_hours") {
      ctrl = (<select className={cls} style={style} value={form[s.id]} onChange={(e) => set(s.id, e.target.value)}>
        <option value="">Select</option>
        {hoursList.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>);
    } else if (s.id === "ddl_machine") {
      /* legacy Machine_list(): Value=ITEM_code, Text=ITEM_NAME + "Select" head */
      ctrl = (<select className={cls} style={style} value={form[s.id]} onChange={(e) => set(s.id, e.target.value)}>
        <option value="Select">Select</option>
        {machines.map((x) => <option key={x.item_code} value={x.item_code}>{x.item_name}</option>)}
      </select>);
    } else if (s.kind === "sel") {
      ctrl = (<select className={cls} style={style} value={form[s.id]} disabled={!!disMap[s.id]}
        onChange={(e) => (TAXABLE_IDS.has(s.id) ? taxableChange(s.id, e.target.value) : set(s.id, e.target.value))}>
        {(s.opts ?? []).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>);
    } else if (s.kind === "multi") {
      ctrl = (<select multiple className={cls} style={{ ...style, height: "56px" }} value={[]} onChange={() => { }}>
        {(s.opts ?? []).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>);
    } else if (s.kind === "date") {
      // Start Date / End Date: read-only, auto-filled from the client designation (legacy
      // txt_start_date.ReadOnly = txt_end_date.ReadOnly = true).
      const roDate = s.id === "txt_start_date" || s.id === "txt_end_date";
      ctrl = (<input type="date" className={cls} style={style} value={form[s.id]}
        readOnly={roDate}
        onChange={roDate ? undefined : (e) => set(s.id, e.target.value)}
        title={roDate ? "Client designation se auto-fill — read-only (legacy jaisa)" : undefined} />);
    } else if (s.kind === "ro") {
      ctrl = (<input className={cls} style={style} value={form[s.id]} readOnly />);
    } else if (s.kind === "num") {
      ctrl = (<input className={cls} style={style} value={form[s.id]}
        readOnly={!!roMap[s.id]} disabled={!!disMap[s.id]}
        onChange={(e) => set(s.id, e.target.value.replace(/[^0-9.]/g, ""))} />);
    } else {
      ctrl = (<input className={cls} style={style} value={form[s.id]} onChange={(e) => set(s.id, e.target.value)} />);
    }
    const star = ["ddl_unit_client", "ddl_policy", "ddl_clientwisestate", "ddl_unitcode",
      "ddl_unitcode_without", "txt_policy_name1", "txt_start_date", "txt_end_date",
      "ddl_category", "ddl_designation", "ddl_hours", "ddl_month_calc"].includes(s.id);
    return (
      <div key={s.id} className={`col-sm-${s.w ?? 2} col-xs-12 fld`}>
        <span className="fld-label"><b>{s.label}{star && <span className="text-red"> *</span>}</b></span>
        <div className="field-control">{ctrl}</div>
      </div>
    );
  };

  const tabFields = (id: string) => ALL.filter((s) => s.tab === id);

  return (
    <section className="bd-old" style={{ padding: "10px" }}>
      {/* dangerouslySetInnerHTML so React doesn't HTML-escape the CSS (" > &) —
          otherwise server/client text differs and hydration mismatches. */}
      <style dangerouslySetInnerHTML={{ __html: BD_CSS }} />
      <div className="container-fluid">
        <div className="panel panel-primary">
          <div className="panel-heading">
            <div className="row">
              <div className="col-sm-1" />
              <div className="col-sm-9">
                <div className="text-center text-uppercase" style={{ color: "#fff", fontSize: "small" }}>
                  <b>BILLING &amp; SALARY MASTER</b>
                </div>
              </div>
              <div className="col-sm-2 text-right" />
            </div>
          </div>

          <div className="panel-body">
            {msg && <div style={{ color: "green", fontWeight: "bold", textAlign: "center", marginBottom: "10px" }}>{msg}</div>}
            {loadError && <div style={{ color: "#a94442", background: "#f2dede", border: "1px solid #ebccd1", padding: "8px", borderRadius: "4px", marginBottom: "10px" }}>{loadError}</div>}

            {/* top panel — same order as panel1 */}
            <div className="panel panel-primary beige">
              <div className="panel-body">
                {chunk12([...TOP.slice(0, 3), ...(form.ddl_policy === "2" ? TOP.slice(3, 5) : [])]).map((r, i) => (
                  <div key={i} className="row">{r.map(renderSpec)}</div>
                ))}
                <br />
                {chunk12(TOP.slice(5)).map((r, i) => (
                  <div key={i} className="row">{r.map(renderSpec)}</div>
                ))}
                <br />
              </div>
            </div>
            <br />

            {/* tabs — same names/order */}
            <div id="tabs">
              <ul className="nav nav-tabs">
                {TABS.map(([id, label]) => (
                  <li key={id} className={tab === id ? "active" : ""}>
                    <a href={`#${id}`} onClick={(e) => { e.preventDefault(); setTab(id); }}>
                      {label}
                    </a>
                  </li>
                ))}
              </ul>

              {tab !== "menu7" && (
                <div id={tab}>
                  <br />
                  {chunk12(tabFields(tab)).map((r, i) => (
                    <div key={i} className="row">{r.map(renderSpec)}</div>
                  ))}
                  {tab === "menu3" && form.ddl_material_contract === "3" && (
                    <>
                      <br />
                      <div className="row" style={{ margin: 0 }}>
                        <div className="col-sm-2">
                          <button className="btn btn-primary" onClick={() => { void addMaterial(); }}>Add Material</button>
                        </div>
                      </div>
                      <br />
                      <div className="table-responsive">
                        <table className="table" style={{ background: "#fff" }}>
                          <thead style={{ background: "#006699", color: "#fff" }}>
                            <tr><th></th><th>Sr No.</th><th>Material Name</th><th>Rate</th><th>Handling Charges (Amount)</th><th>Handling Charges (%)</th></tr>
                          </thead>
                          <tbody>
                            {materialRows.map((m, i) => (
                              <tr key={m.id}>
                                <td><button className="btn btn-sm btn-danger" onClick={() => { void removeMaterial(m.id); }}>X</button></td>
                                <td>{i + 1}</td><td>{m.material_name}</td><td>{m.rate}</td>
                                <td>{m.handling_charges_amount || "0"}</td><td>{m.handling_percent || "0"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {tab === "menu7" && (
                <div id="menu7">
                  <br />
                  {chunk12(MACHINE_UI).map((r, i) => (
                    <div key={i} className="row">{r.map(renderSpec)}</div>
                  ))}
                  <br />
                  <div className="row" style={{ margin: 0 }}>
                    <div className="col-sm-2">
                      <button className="btn btn-primary" onClick={addMachine}>Add Machine</button>
                    </div>
                  </div>
                  <br />
                  <div className="table-responsive">
                    <table className="table" style={{ background: "#fff" }}>
                      <thead style={{ background: "#006699", color: "#fff" }}>
                        {/* exact legacy gv_product_details BoundFields; machine_code
                            stays hidden (legacy RowDataBound Cells[8].Visible=false) */}
                        <tr><th></th><th>Sr No.</th><th>Machine Name</th><th>Rent Type</th><th>Rent</th><th>Handling Charges</th><th>Handling In %</th><th>Handling In Amount</th><th>No. Quantity</th><th>Admin Cost</th><th>Technical Tools</th></tr>
                      </thead>
                      <tbody>
                        {machineRows.map((m, i) => (
                          <tr key={i}>
                            <td><button className="btn btn-sm btn-danger" onClick={() => setMachineRows((p) => p.filter((_, j) => j !== i))}>X</button></td>
                            <td>{i + 1}</td><td>{m.machineName}</td><td>{m.rateType}</td><td>{m.amount}</td>
                            <td>{m.hc}</td><td>{m.inPer}</td><td>{m.inAmt}</td>
                            <td>{m.qty}</td><td>{m.admin}</td><td>{m.tools}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <br />
            {/* buttons — btnadd / btn_assign / btndelete / btn_close.
                Legacy hides Delete on first load (btndelete.Visible=false); it
                appears once a grid row is picked. Assign runs Req_validation1 +
                the clone flow, NOT a second Save. */}
            <div className="row text-center">
              {selId != null && (
                <label style={{ marginRight: 12 }}>
                  <input type="checkbox" checked={applyAllBranches} onChange={(e) => setApplyAllBranches(e.target.checked)} />
                  &nbsp;Apply to all branches of this State
                </label>
              )}
              <button className="btn btn-primary" onClick={() => { void doSave(); }}>{selId != null ? " Update " : " Save "}</button>
              {form.ddl_policy === "2" && (
                <span>&nbsp;&nbsp;<button className="btn btn-primary" onClick={() => { void doAssign(); }}> Assign Policy </button></span>
              )}
              {selId != null && (
                <span>&nbsp;&nbsp;<button className="btn btn-primary" onClick={() => { void onDelete(); }}> Delete </button></span>
              )}
              &nbsp;&nbsp;<button className="btn btn-danger" onClick={() => router.push("/")}> Close </button>
            </div>
            <br />

            {/* grid — grd_policy (legacy DataTables csv/print/copy/colvis) */}
            <div className="container-fluid">
              <br />
              <div className="no-print" style={{ marginBottom: "8px" }}>
                <ExportButtons
                  filename="policy-master"
                  columns={[
                    { key: "id", label: "ID" },
                    { key: "policy_name1", label: "Policy" },
                    { key: "billing_client_code", label: "Client" },
                    { key: "billing_unit_code", label: "Branch" },
                    { key: "billing_state", label: "State" },
                    { key: "designation", label: "Designation" },
                    { key: "hours", label: "Working Hours" },
                    { key: "start_date", label: "Policy Start Date" },
                    { key: "end_date", label: "Policy End Date" },
                  ]}
                  rows={shownRows}
                />
                <input className="form-control" style={{ display: "inline-block", width: "340px", marginLeft: "10px", verticalAlign: "middle" }}
                  placeholder="Search policy / client / branch / state / designation..." value={gridQuery}
                  onChange={(e) => setGridQuery(e.target.value)} />
                {gridQuery && <button className="btn btn-default btn-sm" style={{ marginLeft: "4px" }} onClick={() => setGridQuery("")}>x</button>}
              </div>
              <div style={{ fontSize: "12px", color: "#8a6d3b", background: "#fcf8e3", border: "1px solid #faebcc", padding: "6px 10px", borderRadius: "4px", marginBottom: "8px" }}>
                To edit a policy: first choose <b>Policy</b> (Statewise / Branchwise) at the top, then click its row below — all fields auto-fill into the form. <b>Save</b> with a row selected updates that policy (VDA wagera usi me badlega); without selection Save adds a new policy.
                <span style={{ float: "right" }}><b>{gridQuery ? `${shownRows.length} / ${rows.length}` : rows.length}</b> polic{rows.length === 1 ? "y" : "ies"} {gridQuery ? "found" : "loaded"} (grid + Excel same list)</span>
              </div>
              <div className="grid-view">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID</th><th>POLICY</th><th>CLIENT</th><th>BRANCH</th>
                      <th>STATE</th><th>DESIGNATION</th><th>HOURS</th><th>START DATE</th><th>END DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownRows.map((r) => (
                      <tr key={r.id} onClick={() => pickRow(r)}
                        className={selId === r.id ? "selected" : ""}
                        style={{ cursor: "pointer" }}>
                        <td>{r.id}</td>
                        <td>{String(r.policy_name1 ?? "")}</td>
                        <td>{String(r.billing_client_code ?? "")}</td>
                        <td>{String(r.billing_unit_code ?? "")}</td>
                        <td>{String(r.billing_state ?? "")}</td>
                        <td>{String(r.designation ?? "")}</td>
                        <td>{String(r.hours ?? "")}</td>
                        <td>{String(r.start_date ?? "")}</td>
                        <td>{String(r.end_date ?? "")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <br />
          </div>
        </div>
      </div>
    </section>
  );
}
