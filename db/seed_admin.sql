-- Run this in Neon Console to Fix the Password
UPDATE users 
SET password_hash = '$2b$10$O5l0iEHQ8eR08N0CGpQ8zuFlq2rwI8d3hTATsfV/w7vmF35Vp.xHC' 
WHERE email = 'AdminL';
