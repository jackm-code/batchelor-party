-- Demo and test passcodes only. Never run this on the real database:
-- set real passcodes there with set_access_code(role, code).
select set_access_code('organiser', 'demo-organiser-code');
select set_access_code('group',     'demo-group-code-0000');
select set_access_code('groom',     'demo-groom-code-0000');
