insert into public.recruiters (name, slug, type, approved) values
 ('Hays', 'hays', 'agency', true),
 ('Reed', 'reed', 'agency', true),
 ('Michael Page', 'michael-page', 'agency', true),
 ('NHS Jobs', 'nhs-jobs', 'in_house', true),
 ('Tesco', 'tesco', 'in_house', true),
 ('Civil Service', 'civil-service', 'in_house', true)
on conflict (slug) do nothing;