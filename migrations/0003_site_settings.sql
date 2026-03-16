-- 0003_site_settings.sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO site_settings (key, value_json) VALUES
  ('siteTitle', '"Photograph"'),
  ('logo', '""'),
  ('favicon', '""'),
  ('description', '""'),
  ('navStyle', '"ins"'),
  ('pageSize', '24'),
  ('colXs', '12'),
  ('colSm', '6'),
  ('colMd', '4'),
  ('colLg', '3'),
  ('coverHeightTimes', '1'),
  ('imgHeightTimes', '1'),
  ('coverTitle', '1'),
  ('coverRadius', '["cr_tl","cr_tr","cr_br","cr_bl"]'),
  ('coverTitleBorder', '["ctb_t","ctb_r","ctb_b","ctb_l"]'),
  ('coverTitleRadius', '["ctr_tl","ctr_tr","ctr_br","ctr_bl"]'),
  ('coverOrn', '"co_none"'),
  ('sideButton', '3'),
  ('notice', '""'),
  ('noticeStyle', '"bottom"'),
  ('noticeColor', '""'),
  ('diyCss', '""'),
  ('infiniteScroll', 'false'),
  ('fancyBox3Opt', '["fb3_download","fb3_thumbs","fb3_close"]'),
  ('lazyImg', '""'),
  ('mobileCate', 'false'),
  ('randomPostPt', '0'),
  ('enableQrcode', 'true'),
  ('hotKeys', 'false');
