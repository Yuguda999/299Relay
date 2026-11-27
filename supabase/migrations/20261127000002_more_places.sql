-- More places on and around ABU Zaria.
-- The campus row is created here too (same fixed id as seed.sql) so the
-- places exist on production and after a local reset. Existing rows are kept.
insert into public.campuses (id, name, short_name, timezone, handoff_curfew)
values ('00000000-0000-4000-a000-000000000001', 'Ahmadu Bello University, Zaria', 'ABU', 'Africa/Lagos', '21:00')
on conflict (id) do nothing;

-- Zones drive trip matching (a trip to a zone matches pickups in it) and the
-- suggested pick-up/drop-off fee (same zone ₦150, otherwise ₦300).
-- Each off-campus area is its own zone. Off-campus places are not handoff
-- points: handoffs stay on campus.
insert into public.places (campus_id, name, kind, zone, is_handoff_point)
select '00000000-0000-4000-a000-000000000001', v.name, v.kind::public.place_kind, v.zone, v.handoff
from (values
  -- On campus: halls
  ('Danfodio Hall',                       'hostel',  'central',    true),
  ('Alexander Hall',                      'hostel',  'central',    true),
  ('Akenzua Hall',                        'hostel',  'central',    true),
  ('Sardauna Hall',                       'hostel',  'central',    true),
  ('Shehu Idris Hall',                    'hostel',  'central',    true),
  -- On campus: faculties and landmarks
  ('Faculty of Arts Entrance',            'faculty', 'central',    true),
  ('Faculty of Social Sciences Entrance', 'faculty', 'central',    true),
  ('Faculty of Education Entrance',       'faculty', 'central',    true),
  ('Faculty of Agriculture Entrance',     'faculty', 'central',    true),
  ('Faculty of Environmental Design Entrance', 'faculty', 'central', true),
  ('Faculty of Pharmaceutical Sciences Entrance', 'faculty', 'central', true),
  ('Kashim Ibrahim Library',              'office',  'central',    true),
  ('University Health Services',          'office',  'central',    true),
  ('ABU Main Mosque',                     'other',   'central',    true),
  -- Markets off campus
  ('Sabon Gari Market',                   'market',  'sabon_gari', false),
  ('Zaria City Market',                   'market',  'zaria_city', false),
  -- Around Zaria
  ('Samaru',                              'area',    'samaru',     false),
  ('Danraka',                             'area',    'danraka',    false),
  ('PZ',                                  'area',    'pz',         false),
  ('Zango',                               'area',    'zango',      false),
  ('Palladan',                            'area',    'palladan',   false),
  ('Hayin Dogo',                          'area',    'hayin_dogo', false),
  ('Bomo',                                'area',    'bomo',       false),
  ('Sabon Gari',                          'area',    'sabon_gari', false),
  ('Tudun Wada',                          'area',    'tudun_wada', false),
  ('Zaria City (Birni)',                  'area',    'zaria_city', false),
  ('Kongo Campus',                        'area',    'kongo',      false),
  ('Shika (ABUTH)',                       'area',    'shika',      false),
  ('Gyallesu',                            'area',    'gyallesu',   false),
  ('Basawa',                              'area',    'basawa',     false),
  ('Kwangila',                            'area',    'kwangila',   false),
  ('Hanwa',                               'area',    'hanwa',      false),
  ('Wusasa',                              'area',    'wusasa',     false),
  ('GRA Zaria',                           'area',    'gra',        false),
  ('Dogarawa',                            'area',    'dogarawa',   false)
) as v(name, kind, zone, handoff)
on conflict (campus_id, name) do nothing;
