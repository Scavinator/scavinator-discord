\c scavinator_rb
GRANT INSERT ON TABLE items TO scavinator_rb_discord;
GRANT SELECT ON TABLE items TO scavinator_rb_discord;
GRANT UPDATE (discord_thread_id, updated_at, page_number) ON TABLE items TO scavinator_rb_discord;
GRANT SELECT ON TABLE team_scav_hunts TO scavinator_rb_discord;
GRANT UPDATE (discord_items_message_id, discord_pages_message_id, updated_at) ON TABLE team_scav_hunts TO scavinator_rb_discord;
GRANT INSERT ON TABLE pages TO scavinator_rb_discord;
GRANT SELECT ON TABLE pages TO scavinator_rb_discord;
GRANT UPDATE (discord_thread_id, discord_message_id, updated_at) ON TABLE pages TO scavinator_rb_discord;
GRANT USAGE ON SEQUENCE items_id_seq, pages_id_seq TO scavinator_rb_discord;
GRANT SELECT ON TABLE list_categories TO scavinator_rb_discord;
