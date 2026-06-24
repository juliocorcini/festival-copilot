-- Squad identity: the create-squad screen (#23.4) gives a group an emoji next to its name
-- (shown in the join card #23.6 "FAM JUNTOS 🔥" and the members header). Additive, nullable.
ALTER TABLE app_group ADD COLUMN emoji TEXT;
