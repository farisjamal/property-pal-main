-- Clean up orphaned records from users table
DELETE FROM users WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Clean up orphaned records from user_roles table  
DELETE FROM user_roles WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Clean up orphaned records from tenant table
DELETE FROM tenant WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Clean up orphaned records from property_owner table
DELETE FROM property_owner WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Clean up orphaned records from admin table
DELETE FROM admin WHERE user_id NOT IN (SELECT id FROM auth.users);