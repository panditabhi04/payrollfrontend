import pymysql
con = pymysql.connect(host='127.0.0.1', port=3306, user='root', password='2002@Aman', database='ihms_18_02_2026')
cur = con.cursor()
cur.execute("select m.comp_code, m.unit_code, m.month, m.year, m.emp_code, e.emp_name, m.tot_days_present from pay_attendance_muster m inner join pay_employee_master e on m.emp_code=e.emp_code and m.comp_code=e.comp_code where e.employee_type='Reliever' and m.tot_days_present > 14 limit 5")
rows = cur.fetchall()
print('RELIEVER>14 COUNT SAMPLE:', rows)
con.close()
