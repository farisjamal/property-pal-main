-- Update user mohamadfaris7979@gmail.com to Administrator role
UPDATE user_roles SET role_id = 1 WHERE user_id = '05ba77ee-230c-4e63-83c4-8515db0dedd1';

-- Also update the users table to keep consistency
UPDATE users SET role_id = 1 WHERE user_id = '05ba77ee-230c-4e63-83c4-8515db0dedd1';