-- Run this in your Neon Console SQL Editor to create the Admin user
INSERT INTO users (email, password_hash, name)
VALUES 
    ('AdminL', '$2b$10$qjU.sscQEvNlzHf..R/.tejg1U.HwpCpr5CZA7jk2uvew4pHfxhhe', 'Admin User')
ON CONFLICT (email) DO UPDATE 
SET password_hash = '$2b$10$qjU.sscQEvNlzHf..R/.tejg1U.HwpCpr5CZA7jk2uvew4pHfxhhe';
