INSERT INTO `t_payment` (`id`, `payment`, `payname`, `payimage`, `alias`, `sign_type`, `app_id`, `app_secret`, `ali_public_key`, `rsa_private_key`, `configure3`,`configure4`, `overtime`, `active`) VALUES(12, 'PAYPAL', 'PAYPAL', '/res/images/pay/paypal.jpg', 'paypal', 'RSA2', '', '', '', '', 'live','7', 0, 0);
ALTER TABLE `t_order` ADD `configure1` TEXT NOT NULL DEFAULT '' COMMENT '额外配置1' AFTER `kami`;
ALTER TABLE `t_email` CHANGE `isssl` `smtp_crypto` TINYINT(1) NOT NULL DEFAULT '0' COMMENT '0关，1开SMTP加密方式 0关，1ssl,2tls';
ALTER TABLE `t_email` ADD `protocol` VARCHAR(255) NOT NULL DEFAULT 'smtp' COMMENT '邮件发送协议' AFTER `isdelete`;