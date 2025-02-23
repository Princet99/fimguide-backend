const comingUpQuery = `
   SELECT 
    sc_ln_no AS loan_no,
    sc_adjust AS adjustment,
    pm_balance + sc_adjust AS balance,
    DATE_FORMAT(sc_date, '%m/%d/%Y') AS due_date,
    sc_due AS amount_due
FROM 
    schedule
left join payment on payment.pm_sc_id = schedule.sc_id
WHERE 
    sc_ln_no = ?
    AND sc_active = 'Y'
    AND sc_payor = 2
    limit 1;
`;

const loanStateQuery = `
SELECT 
    sc_ln_no AS loan_no,
    SUM(sc_due) OVER (PARTITION BY sc_ln_no) AS total_due_amount,
    sc_balance AS balance,
    sc_date AS schedule_date
FROM 
    schedule
WHERE 
    sc_ln_no = ? -- Replace with loan number
    AND sc_date <= ?
    AND sc_active = 'Y'
    AND sc_payor = 2
ORDER BY 
    sc_date DESC
LIMIT 1;

`;

const loanstateinfoQuery = `
SELECT s.*, ss.ss_category, ss.ss_value, ss.ss_description
FROM schedule s
JOIN schedule_status ss
    ON s.sc_payor = ss.ss_category_id
WHERE s.sc_ln_no = ?  -- Replace with the actual loan number
AND ss.ss_value = 'Lender';`;

module.exports = { comingUpQuery, loanStateQuery, loanstateinfoQuery };
