const userDetailsQuery = `
  SELECT 
    u.us_id AS id,
    u.us_first_name AS first_name,
    u.us_last_name AS last_name,
    lu.lu_role AS role,
    lu.lu_nickname AS nickname,
    lu.lu_ln_no AS loan_no
FROM 
    user u
LEFT JOIN 
    loanuser lu ON u.us_id = lu.lu_user_id
LEFT JOIN 
    loan l ON lu.lu_ln_no = l.ln_no
WHERE 
    u.us_id = ?
GROUP BY 
    u.us_id, u.us_first_name, u.us_last_name, lu.lu_role, lu.lu_ln_no, lu.lu_nickname
ORDER BY 
    CASE 
        WHEN lu.lu_role = 'borrower' THEN 1
        ELSE 2
    END;
`;

module.exports = { userDetailsQuery };
