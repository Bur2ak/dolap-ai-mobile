alter table wardrobe_items
  add column if not exists fabric text,
  add column if not exists usage_context text[] default '{}';

update wardrobe_items
set usage_context = '{}'
where usage_context is null;
