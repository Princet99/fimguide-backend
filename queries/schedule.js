const comingUpQuery = `
   SELECT 
    sc_ln_no AS loan_no,
    DATE_FORMAT(sc_date, '%m/%d/%Y') AS due_date,
    sc_due AS amount_due
FROM 
    schedule
left join payment on payment.pm_sc_id = schedule.sc_id
WHERE 
    sc_ln_no = ?
    AND sc_active = 'Y'
    AND sc_payor = 1 -- 1 is borrower 2 is lender
    order by sc_date asc
    limit 1;
`;

const loancapitalQuery = `
SELECT 
    sc_ln_no AS loan_no,
    sc_paid,
    CASE 
        WHEN sc_paid = p.pm_principal THEN 'Y'
        ELSE 'N'
    END AS loan_amount_paid,
    DATE_format(sc_date, '%m/%d/%Y') AS schedule_date
FROM 
    schedule
LEFT JOIN payment p on sc_id  = p.pm_sc_id
WHERE 
    sc_ln_no = ? -- Replace with loan number
    AND sc_active = 'Y'
    AND sc_payor = 2;`;

const loanStateQuery = `
SELECT 
    sc_ln_no AS loan_no,
    SUM(sc_due) OVER (PARTITION BY sc_ln_no) AS total_due_amount,
    DATE_format(sc_date, '%m/%d/%Y') AS schedule_date,
    sc_interest as interest,
    sc_principal as principal,
    sc_due as due_amount
FROM 
    schedule
WHERE 
    sc_ln_no = ? -- Replace with loan number
    AND sc_active = 'Y'
    AND sc_payor = 1
    AND sc_date < curdate()
ORDER BY
    sc_date DESC;
`;

const currentbalanceQuery = `SELECT 
    pm_ln_no AS loan_no,
    DATE_format(sc_date, '%m/%d/%Y') AS payment_date,
	pm_balance as balance
FROM 
    payment
 left JOIN
	schedule s ON payment.pm_sc_id = s.sc_id
WHERE 
    pm_ln_no = ? -- Replace with loan number
    AND pm_payor = 1
    AND pm_date < ?
ORDER BY 
    sc_date DESC
    limit 1;`;

const loanstateinfoQuery = `
SELECT s.*, ss.ss_category, ss.ss_value, ss.ss_description
FROM schedule s
JOIN schedule_status ss
    ON s.sc_payor = ss.ss_category_id
WHERE s.sc_ln_no = ?  -- Replace with the actual loan number
AND ss.ss_value = 'Lender';`;

module.exports = {
  comingUpQuery,
  loanStateQuery,
  currentbalanceQuery,
  loanstateinfoQuery,
  loancapitalQuery,
};
