const userDetailsQuery = `
  SELECT 
    u.id AS id,
    u.first_name AS first_name,
    u.last_name AS last_name,
    lu.role AS role,
    lu.nickname AS nickname,
    lu.loan_no AS loan_no
  FROM 
    user u
  LEFT JOIN 
    loan_user lu ON u.id = lu.user_id
  LEFT JOIN 
    loan l ON lu.loan_no = l.loan_no
  WHERE 
    u.id = ?
  GROUP BY 
    u.id, u.first_name, u.last_name, lu.role, lu.loan_no, lu.nickname 
  ORDER BY 
    CASE 
        WHEN lu.role = 'borrower' THEN 1
        ELSE 2
    END;
`;

module.exports = { userDetailsQuery };
