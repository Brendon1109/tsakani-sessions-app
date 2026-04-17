-- Auto-promote admin emails whenever a profile is created or updated
CREATE OR REPLACE FUNCTION promote_admins_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IN (
    'mapindabrendon@gmail.com',
    'tsakanisessions@gmail.com',
    'brendon@automationarchitects.ai',
    'bmapinda303@gmail.com'
  ) THEN
    NEW.role := 'admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS promote_admins_trigger ON profiles;
CREATE TRIGGER promote_admins_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION promote_admins_on_signup();

-- Promote any existing profiles with these emails
UPDATE profiles
SET role = 'admin'
WHERE email IN (
  'mapindabrendon@gmail.com',
  'tsakanisessions@gmail.com',
  'brendon@automationarchitects.ai',
  'bmapinda303@gmail.com'
);
