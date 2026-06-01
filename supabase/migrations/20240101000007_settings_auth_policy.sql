-- Allow authenticated admin users to update app_settings from the admin panel
CREATE POLICY "Authenticated can update settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
