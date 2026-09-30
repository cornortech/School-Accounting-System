// Full API test: schools, fees, students, payments, payroll, expenses, ledger, reports, security.
// ⚠️ Run ONLY against a TEST database - it creates schools and records.
//
//   API_URL=http://localhost:5000 SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... node tests/api-test.mjs
const API = (process.env.API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const R = Date.now().toString(36); // makes emails/codes unique so the test can run many times
const B=API+'/api'; let pass=0, failN=0;
const ok=(c,m)=>{ if(c){pass++;} else {failN++; console.log('❌',m);} };
async function call(method, path, token, body, headers={}){ const r=await fetch(B+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...headers},body:body?JSON.stringify(body):undefined}); let j={}; try{j=await r.json()}catch{} return {s:r.status,j}; }
const login=async(e,p)=>(await call('POST','/auth/login',null,{email:e,password:p}));

// super admin
let r=await login(process.env.SUPER_ADMIN_EMAIL,process.env.SUPER_ADMIN_PASSWORD); ok(r.s===200&&r.j.token,'super login'); const SA=r.j.token;
r=await login(process.env.SUPER_ADMIN_EMAIL,'wrong-password'); ok(r.s===401 && r.j.message==='Incorrect email or password.','wrong pw generic');
r=await login('nobody@example.com','wrong'); ok(r.j.message==='Incorrect email or password.','unknown email same message');
r=await call('GET','/auth/demo-accounts'); ok(r.s===401||r.s===404,'demo accounts gone ('+r.s+')');

// create 2 schools
r=await call('POST','/schools',SA,{name:'Shree Janata Secondary School',code:'SJ'+R,email:`info.${R}@sjss.test`,adminName:'Ram Sharma',adminEmail:`admin.${R}@sjss.test`,adminPassword:'short'}); ok(r.s===400,'weak admin pw rejected');
r=await call('POST','/schools',SA,{name:'Shree Janata Secondary School',code:'SJ'+R,email:`info.${R}@sjss.test`,adminName:'Ram Sharma',adminEmail:`admin.${R}@sjss.test`,adminPassword:'sjss-admin-pass'}); ok(r.s===201,'school A created '+JSON.stringify(r.j).slice(0,120)); const A=r.j.school.schoolId; ok(r.j.school.currencySymbol==='Rs.','default Rs.');
r=await call('POST','/schools',SA,{name:'Everest English School',code:'EE'+R,adminEmail:`admin.${R}@ees.test`,adminPassword:'ees-admin-pass1'}); const Bs=r.j.school.schoolId; ok(Bs && Bs!==A,'school B '+Bs);
r=await call('POST','/schools',SA,{name:'Dup',code:'SJ'+R,adminEmail:'x@y.np',adminPassword:'aaaaaaaaaa'}); ok(r.s===400,'dup code');
r=await call('GET','/schools',SA); ok(r.j.schools.length>=2,'list schools');

let a=(await login(`admin.${R}@sjss.test`,'sjss-admin-pass')).j; const TA=a.token; ok(a.user.school.schoolId===A,'school admin login');
let b=(await login(`admin.${R}@ees.test`,'ees-admin-pass1')).j.token;
r=await call('GET','/schools',TA); ok(r.s===403,'school admin blocked from /schools');

// add accountant + reception
r=await call('POST',`/schools/${A}/users`,SA,{name:'Sita Accountant',email:`acc.${R}@sjss.test`,password:'acc-pass-123',role:'accountant'}); ok(r.s===201,'add accountant');
r=await call('POST',`/schools/${A}/users`,SA,{name:'Hari Reception',email:`rec.${R}@sjss.test`,password:'rec-pass-123',role:'reception'}); ok(r.s===201,'add reception');
const ACC=(await login(`acc.${R}@sjss.test`,'acc-pass-123')).j.token; const REC=(await login(`rec.${R}@sjss.test`,'rec-pass-123')).j.token;

// fees
r=await call('POST','/fees/structures',TA,{title:'Monthly Tuition',category:'Tuition',amount:3500,class:'Grade 8',frequency:'Monthly',dueDate:'2020-01-10'}); ok(r.s===201 && r.j.structure.feeId==='FEE-TUI-01','fee 1 '+r.j.structure?.feeId);
r=await call('POST','/fees/structures',TA,{title:'Exam Fee',category:'Exam',amount:1200,class:'All'}); ok(r.s===201,'fee 2');
r=await call('POST','/fees/structures',TA,{title:'Bad',category:'Tuition',amount:-5}); ok(r.s===400,'negative fee rejected');

// students
r=await call('POST','/students',REC,{fullName:'Aarav Thapa',class:'Grade 8',parentName:'Bikash Thapa',parentPhone:'9800000001'}); ok(r.s===201,'student 1'); const s1=r.j.student; ok(s1.feeAccount.totalFee===4700,'fee total from structures '+s1.feeAccount.totalFee); ok(s1.feeAccount.status==='overdue','overdue because due date passed: '+s1.feeAccount.status);
r=await call('POST','/students',REC,{fullName:'Priya Gurung',class:'Grade 5',parentName:'Maya Gurung',parentPhone:'9800000002'}); const s2=r.j.student; ok(s2.feeAccount.totalFee===1200,'grade5 only All fee');
ok(s1.studentId!==s2.studentId && s1.admissionNo!==s2.admissionNo,'unique ids '+s1.studentId+' '+s2.studentId+' '+s1.admissionNo+' '+s2.admissionNo);
r=await call('POST','/students',b,{fullName:'Other School Kid',class:'Grade 1',parentName:'X',parentPhone:'9811111111'}); const sB=r.j.student;

// tenant isolation
r=await call('GET','/students',b); ok(r.j.students.length===1 && r.j.students[0].fullName==='Other School Kid','B sees only own students');
r=await call('GET',`/students/${s1.studentId}`,b); ok(r.s===404 || r.j.student?.fullName!=='Aarav Thapa','B cannot open A student');
r=await call('GET','/students',b,null,{'X-School-Id':A}); ok(r.j.students.every(s=>s.fullName!=='Aarav Thapa'),'X-School-Id ignored for school users');
r=await call('GET','/students',SA,null,{'X-School-Id':A}); ok(r.j.students.length===2,'super admin can open school A');
r=await call('GET','/students',SA); ok(r.s===400,'super admin needs school selected');

// payments
r=await call('POST','/billing/payments',REC,{studentId:s1.studentId,paidAmount:-100,paymentMethod:'Cash'}); ok(r.s===400,'negative payment rejected');
r=await call('POST','/billing/payments',REC,{studentId:s1.studentId,paidAmount:2000,discount:200,paymentMethod:'Cash'}); ok(r.s===201 && r.j.receipt.receiptNumber.endsWith('-0001'),'payment 1 '+r.j.receipt?.receiptNumber); ok(r.j.feeAccount.pendingAmount===2500,'pending 2500: '+r.j.feeAccount.pendingAmount); const rc1=r.j.receipt.receiptNumber; ok(r.j.receipt.transactionRef==='','no fake transaction ref');
r=await call('POST','/billing/payments',ACC,{studentId:s1.studentId,paidAmount:2500,paymentMethod:'Bank Transfer',transactionRef:'NIC-778812'}); ok(r.j.feeAccount.status==='paid' && r.j.feeAccount.pendingAmount===0,'fully paid');
r=await call('POST','/billing/payments',REC,{studentId:s2.studentId,paidAmount:1500,paymentMethod:'Online/UPI',feeItems:[{category:'Exam',amount:1200},{category:'Sports kit',amount:300}]}); ok(r.s===201 && r.j.receipt.extraCharged===300 && r.j.feeAccount.totalFee===1500 && r.j.feeAccount.pendingAmount===0,'extra charges added to total: '+JSON.stringify(r.j.feeAccount));
const rc3=r.j.receipt.receiptNumber;
r=await call('POST','/billing/payments',b,{studentId:s2.studentId,paidAmount:100,paymentMethod:'Cash'}); ok(r.s===404,'B cannot pay a student that only A has');
// concurrent payments => unique receipt numbers
const conc=[]; for (const _ of [1,2,3,4,5]) conc.push(await call('POST','/billing/payments',REC,{studentId:s2.studentId,paidAmount:10,paymentMethod:'Cash'}));
const nums=conc.map(x=>x.j.receipt?.receiptNumber); ok(new Set(nums).size===5 && nums.every(Boolean),'5 receipts, sequential numbers: '+nums.join(','));
// cancel
r=await call('PATCH',`/billing/receipts/${rc3}/cancel`,REC,{reason:'test'}); ok(r.s===403,'reception cannot cancel');
r=await call('PATCH',`/billing/receipts/${rc3}/cancel`,TA,{reason:'Wrong student'}); ok(r.s===200,'cancel '+JSON.stringify(r.j).slice(0,100));
r=await call('PATCH',`/billing/receipts/${rc3}/cancel`,TA,{}); ok(r.s===400,'double cancel blocked');
r=await call('GET',`/students/${s2.studentId}`,TA); ok(r.j.feeAccount.totalFee===1250 && r.j.feeAccount.paidAmount===50 && r.j.feeAccount.pendingAmount===1200,'cancel reversed extra & paid: '+JSON.stringify(r.j.feeAccount));
r=await call('GET',`/billing/receipts/${rc1}`,TA); ok(r.j.school.name==='Shree Janata Secondary School' && r.j.receipt,'receipt detail');
r=await call('DELETE',`/students/${s1.studentId}`,TA); ok(r.s===400,'cannot delete student with payments');

// staff & payroll
r=await call('POST','/staff',ACC,{fullName:'X',roleType:'teaching',designation:'T',baseSalary:1}); ok(r.s===403,'accountant cannot add staff');
r=await call('POST','/staff',TA,{fullName:'Gita Karki',roleType:'teaching',designation:'Science Teacher',teachingSubject:'Science',baseSalary:30000,allowances:2000,deductions:1500}); ok(r.s===201 && r.j.staff.netSalary===30500 && r.j.staff.staffId==='STF-001','staff net '+r.j.staff?.netSalary);
r=await call('POST','/staff',TA,{fullName:'Kamal Rai',roleType:'non_teaching',designation:'Driver',baseSalary:18000}); ok(r.s===201,'staff 2');
r=await call('POST','/salary/generate-batch',ACC,{month:'September',year:2026}); ok(r.j.generatedCount===2,'payroll gen '+r.j.generatedCount);
r=await call('POST','/salary/generate-batch',ACC,{month:'September',year:2026}); ok(r.j.generatedCount===0,'no duplicate payroll');
r=await call('GET','/salary',ACC); const pay1=r.j.payrolls.find(p=>p.staffName==='Gita Karki');
r=await call('POST',`/salary/${pay1.payrollId}/pay`,ACC,{paymentMethod:'Bank Transfer'}); ok(r.s===200,'pay salary');
r=await call('POST',`/salary/${pay1.payrollId}/pay`,ACC,{}); ok(r.s===400,'no double salary');
r=await call('GET',`/salary/${pay1.payrollId}/payslip`,ACC); ok(r.j.staff?.fullName==='Gita Karki','payslip');

// expenses
r=await call('POST','/expenses',ACC,{category:'Utilities',amount:4200,description:'Electricity bill - Sept',vendorOrPerson:'NEA'}); ok(r.s===201,'expense'); const e1=r.j.expense.expenseId;
r=await call('PUT',`/expenses/${e1}`,ACC,{amount:4500}); ok(r.j.expense.amount===4500,'edit expense');
r=await call('POST','/expenses',ACC,{category:'Maintenance',amount:1000,description:'Tap repair',vendorOrPerson:'Plumber'}); const e2=r.j.expense.expenseId;
r=await call('DELETE',`/expenses/${e2}`,TA); ok(r.s===200,'delete expense');

// ledger math
r=await call('POST','/ledger/journal-entry',ACC,{type:'credit',category:'Opening Balance',amount:10000,description:'Cash in hand on start'}); ok(r.s===201,'journal');
r=await call('GET','/ledger',ACC); const L=r.j.summary;
// credits: 2000+2500+1500+50 (5x10) + 1000(del reversal) + 10000 = 17050 ; debits: 1500(cancel)+30500+4500+1000 = 37500
ok(L.totalCredits===17050 && L.totalDebits===37500 && L.currentBalance===-20450,'ledger totals '+JSON.stringify(L));
ok(r.j.transactions[0].runningBalance===L.currentBalance,'running balance top = current');

// reports
r=await call('GET','/reports/summary',TA); const k=r.j.kpis;
ok(k.totalFeeCollected===4550 && k.totalOperationalExpenses===4500 && k.totalSalaryPaid===30500,'kpis '+JSON.stringify({c:k.totalFeeCollected,e:k.totalOperationalExpenses,s:k.totalSalaryPaid}));
ok(r.j.monthlyTrends.length===6 && r.j.monthlyTrends.at(-1).income===4550,'real trend this month '+JSON.stringify(r.j.monthlyTrends.at(-1)));
r=await call('GET','/reports/income-vs-expense?year=2026',TA); ok(r.j.statement.income.totalIncome===4550 && r.j.statement.expenses.totalExpenses===35000,'P&L 2026');
r=await call('GET','/reports/income-vs-expense?year=2025',TA); ok(r.j.statement.income.totalIncome===0,'P&L 2025 empty');
r=await call('GET','/reports/pending-fees',TA); ok(r.j.records.length===1 && r.j.records[0].pendingAmount===1200,'pending report '+JSON.stringify(r.j.summary));
r=await call('GET','/ledger',b); ok(r.j.summary.transactionCount===0,'school B ledger isolated');

// deactivate school
r=await call('PATCH',`/schools/${A}/status`,SA,{status:'inactive'}); ok(r.s===200,'deactivate');
r=await call('GET','/students',TA); ok(r.s===403 && r.j.code==='SCHOOL_INACTIVE','existing token blocked immediately');
r=await login(`admin.${R}@sjss.test`,'sjss-admin-pass'); ok(r.s===403,'login blocked when inactive');
await call('PATCH',`/schools/${A}/status`,SA,{status:'active'});
// injection attempts
r=await call('POST','/auth/login',null,{email:{$ne:null},password:{$ne:null}}); ok(r.s===400||r.s===401,'nosql login injection '+r.s);
r=await call('GET','/students?status[$ne]=x',TA); ok(r.s===200,'query injection harmless');
r=await call('POST','/auth/change-password',TA,{currentPassword:'sjss-admin-pass',newPassword:'new-sjss-pass-9'}); ok(r.s===200,'change pw');
r=await login(`admin.${R}@sjss.test`,'new-sjss-pass-9'); ok(r.s===200,'login new pw');

console.log(`\n${pass} passed, ${failN} failed`);
