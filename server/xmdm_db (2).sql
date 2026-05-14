-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- 主机： localhost
-- 生成日期： 2026-05-08 13:00:43
-- 服务器版本： 5.7.44-log
-- PHP 版本： 8.0.26

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- 数据库： `xmdm_db`
--

-- --------------------------------------------------------

--
-- 表的结构 `api_keys`
--

CREATE TABLE `api_keys` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `api_key` varchar(64) NOT NULL,
  `api_secret` varchar(128) DEFAULT NULL,
  `tokens_balance` int(11) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- 转存表中的数据 `api_keys`
--

INSERT INTO `api_keys` (`id`, `user_id`, `api_key`, `api_secret`, `tokens_balance`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 1, '4653796e8554a512ef1311d955f35761', 'c4569a99a6318b29cc0045dc80b049d7', 100, 1, '2026-03-24 18:41:49', '2026-03-24 18:41:49'),
(2, 2, '61973eae1727d43072908abee77bb6b0', '0463603dfa485e784d302a80bf55888c', 100, 1, '2026-04-24 16:42:19', '2026-04-24 16:42:19'),
(3, 3, '5adfcd4450e5027da832d9f3fc1b3f0b', '9dd17f611a8096db77791ef4dcea62ba', 100, 1, '2026-04-25 08:41:11', '2026-04-25 08:41:11'),
(4, 4, 'fe460094d90ef95227aec1da1119c180', '192caca1e6aba23ee0cdc63f65a6546d', 100, 1, '2026-04-25 10:47:29', '2026-04-25 10:47:29'),
(5, 5, '1ee3c0d2d69fdde845a2bbdc42225e43', '8c5b6be66ec451efa3c654c373a3ae0c', 100, 1, '2026-04-25 15:22:33', '2026-04-25 15:22:33'),
(6, 6, 'a35702aee3307085260474497957294d', '4d5adfd9bfba8feab754556b28b72451', 100, 1, '2026-04-27 11:16:31', '2026-04-27 11:16:31'),
(7, 7, 'fc49cdb134e5b159f552ce04bfd0ec0d', 'fc2d452c478acf9ba786f31987db86c7', 100, 1, '2026-04-28 22:10:58', '2026-04-28 22:10:58'),
(8, 8, '5ff4aa64adc9a3261f33a3da8df8360d', '862deb6b034fc6323b51771c57dcd1f8', 100, 1, '2026-04-29 09:54:47', '2026-04-29 09:54:47'),
(9, 9, 'c52a8ac367bc50163f7d61f4105c4d45', '7a0812fee3077493e0a517d1d81781e7', 100, 1, '2026-04-29 16:40:44', '2026-04-29 16:40:44'),
(10, 10, '0161c4b5856a4e34e3849150fd2b6b13', '53e11ce9482369a7c1af3237d915eb2b', 100, 1, '2026-04-29 23:51:15', '2026-04-29 23:51:15'),
(11, 11, 'd1d788a83f1e9621db077d766cf61945', 'd2b71dd42ff6704b9f1a86a0be0dc9fc', 100, 1, '2026-04-30 09:48:05', '2026-04-30 09:48:05'),
(12, 12, 'ebaea825a227426c0d7425b35595fe54', 'ab3f4533d72bf2210dc2d886878ec87d', 100, 1, '2026-04-30 10:11:07', '2026-04-30 10:11:07'),
(13, 13, '6a8763bb9a398199529993a775d739d9', 'e27376020b623e16d99b7ce0f9a40ace', 100, 1, '2026-04-30 11:50:23', '2026-04-30 11:50:23'),
(14, 14, '35884639c345a0adb1c42911cc636544', '5668f46f0d91aa39de77475a48944149', 100, 1, '2026-04-30 13:11:27', '2026-04-30 13:11:27'),
(15, 15, 'b7ea565883090a91e5ab56f872307e57', 'be0ed18e66aabe4671d6c0463c34af86', 100, 1, '2026-04-30 14:18:33', '2026-04-30 14:18:33'),
(16, 16, 'ef03e6ebbb5786532061c389c5050b6d', '7b617bc08ec5d2b67bcbcbc2be729397', 100, 1, '2026-04-30 22:55:11', '2026-04-30 22:55:11'),
(17, 17, 'd26fdef2efd37ca2ebc3ea716284d997', 'f136a87db3987d6f379d2740cfa7a1fe', 100, 1, '2026-05-01 00:31:04', '2026-05-01 00:31:04'),
(18, 18, 'c9a100655cda8bd1c07b5324786fd375', '50832063381ab3f506cce8d6bd158d63', 100, 1, '2026-05-01 13:54:29', '2026-05-01 13:54:29'),
(19, 19, '9c77e4ae0367b42af5555767c35b6241', '04f8d2c651c6bc5e5d1791199d0d22bb', 100, 1, '2026-05-01 16:05:43', '2026-05-01 16:05:43'),
(20, 20, '5a5b16295d78b845f3269bb32574e58f', '390d17ef54de3fc8d1fa12a73ad97472', 100, 1, '2026-05-01 22:53:18', '2026-05-01 22:53:18'),
(21, 21, '1d1798ba876130a435ad03bb57e1ce0f', 'c907a939d789d14f18ea2fa7fd7d2c73', 100, 1, '2026-05-02 00:13:17', '2026-05-02 00:13:17'),
(22, 22, '965b7b0eeb38b08877fdc20ac2538494', '292faffb5f1c4a1c5a5ee5f9d45d24a9', 100, 1, '2026-05-02 10:01:36', '2026-05-02 10:01:36'),
(23, 23, '6f20fe3e8dd2377b9261cd44c6cdeab8', '3f153d0167a2b427ec215841cd678f1a', 100, 1, '2026-05-02 15:34:36', '2026-05-02 15:34:36'),
(24, 24, 'eadf3bf595b9d90014c2cb79ae9e2195', 'e540045bbe93bf4cb944725045315346', 100, 1, '2026-05-03 13:32:40', '2026-05-03 13:32:40'),
(25, 25, '3e842be9fbfe2f5783e28f3f16a93e62', 'c253911e58a6bde2fa0b4d0d9351bc98', 100, 1, '2026-05-03 15:49:23', '2026-05-03 15:49:23'),
(26, 26, 'c3494567cf318161f80ac0e7d636b4b2', '4911f06428d8e2a558cc84827a058d6e', 100, 1, '2026-05-03 17:40:04', '2026-05-03 17:40:04'),
(27, 27, '15470b0be79e1669323fc5ad9b24a98a', 'ddcd600ae3a06973a4d7ea4f44b55430', 100, 1, '2026-05-03 22:19:14', '2026-05-03 22:19:14'),
(28, 28, '42c17a7ebd244da4094c5647989dd871', '97228a63b8ab490a23f039cd1ecbecb8', 100, 1, '2026-05-04 09:46:16', '2026-05-04 09:46:16'),
(29, 29, 'ae509ff988d3497ac088dfbed963adab', 'ea5701ae0012e30a87ba16f92698d546', 100, 1, '2026-05-06 07:48:54', '2026-05-06 07:48:54'),
(30, 30, '56b7ab06b1015cb02a3c0ee3611a2426', '83a3dbec73f270e3faafe1515e67f0f8', 100, 1, '2026-05-06 08:37:10', '2026-05-06 08:37:10'),
(31, 31, 'ed6f1fcadda58e204e8abb416c689958', '5f930b91ff7fb220e3539678a584b51d', 100, 1, '2026-05-06 20:28:14', '2026-05-06 20:28:14'),
(32, 32, '832b1daf7038316d7b212e2a40e5fba6', '888f6ee8efa491bc4429d15a8b288321', 100, 1, '2026-05-07 13:56:16', '2026-05-07 13:56:16'),
(33, 33, '049f0de3d8c3f00d41f17c54f5f244f5', '9c065c20eeb9725e5679b45ab0e84c4a', 100, 1, '2026-05-07 18:07:03', '2026-05-07 18:07:03'),
(34, 34, '9a6216f3b71ece900351f2f122cd15b7', '84d0a0e6c2596826cf6c25801062fec3', 100, 1, '2026-05-07 22:33:56', '2026-05-07 22:33:56'),
(35, 35, '023d6bdb97d9d8a9160ecd3996f31b59', '499d5214fcd4d273ed4009beeb886bfa', 100, 1, '2026-05-08 09:48:18', '2026-05-08 09:48:18');

-- --------------------------------------------------------

--
-- 表的结构 `orders`
--

CREATE TABLE `orders` (
  `id` int(11) NOT NULL,
  `order_no` varchar(64) NOT NULL,
  `user_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_method` varchar(20) NOT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `product_type` varchar(50) DEFAULT NULL,
  `trade_no` varchar(100) DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- 转存表中的数据 `orders`
--

INSERT INTO `orders` (`id`, `order_no`, `user_id`, `amount`, `payment_method`, `status`, `product_type`, `trade_no`, `paid_at`, `created_at`, `updated_at`) VALUES
(1, 'XMTCEGE374FA11', 1, 99.00, 'wechat', 'pending', 'vip_quarterly', NULL, NULL, '2026-03-24 18:42:03', '2026-03-24 18:42:03'),
(2, 'XMTCEGFMF99A29', 1, 99.00, 'wechat', 'pending', 'vip_quarterly', NULL, NULL, '2026-03-24 18:42:58', '2026-03-24 18:42:58'),
(3, 'XMTCEGG46B6B1C', 1, 99.00, 'wechat', 'pending', 'vip_quarterly', NULL, NULL, '2026-03-24 18:43:16', '2026-03-24 18:43:16'),
(4, 'XMTCEGQ34F5664', 1, 99.00, 'wechat', 'pending', 'vip_quarterly', NULL, NULL, '2026-03-24 18:49:15', '2026-03-24 18:49:15'),
(5, 'XMTCEIZ514E557', 1, 38.00, 'wechat', 'pending', 'vip_monthly', NULL, NULL, '2026-03-24 19:37:53', '2026-03-24 19:37:53'),
(6, 'XMTCEIZZ03029C', 1, 38.00, 'wechat', 'pending', 'vip_monthly', NULL, NULL, '2026-03-24 19:38:23', '2026-03-24 19:38:23'),
(7, 'XMTCEJ730C1CDC', 1, 38.00, 'wechat', 'pending', 'vip_monthly', NULL, NULL, '2026-03-24 19:42:39', '2026-03-24 19:42:39'),
(8, 'XMTCEJ8QFB540F', 1, 1.00, 'wechat', 'pending', 'vip_monthly', NULL, NULL, '2026-03-24 19:43:38', '2026-03-24 19:43:38'),
(9, 'XMTCEJW8CC9F81', 1, 1.00, 'wechat', 'pending', 'vip_monthly', NULL, NULL, '2026-03-24 19:57:44', '2026-03-24 19:57:44'),
(10, 'XMTCEK8529EFA4', 1, 1.00, 'wechat', 'pending', 'vip_monthly', NULL, NULL, '2026-03-24 20:04:53', '2026-03-24 20:04:53'),
(11, 'XMTCEKGI196721', 1, 1.00, 'wechat', 'paid', 'vip_monthly', '4200002984202603246519242598', '2026-03-24 20:29:14', '2026-03-24 20:09:54', '2026-03-24 20:29:14'),
(12, 'XMTCELD63B341E', 1, 0.10, 'wechat', 'paid', 'vip_monthly', '4200003047202603249195659885', '2026-03-24 20:29:47', '2026-03-24 20:29:30', '2026-03-24 20:29:47'),
(13, 'XMTCER3SA0370A', 1, 0.10, 'wechat', 'pending', 'vip_monthly', NULL, NULL, '2026-03-24 22:33:28', '2026-03-24 22:33:28'),
(14, 'XMTDBWYZ64260E', 1, 88.00, 'wechat', 'pending', 'vip_quarterly', NULL, NULL, '2026-04-11 20:20:59', '2026-04-11 20:20:59'),
(15, 'XMTE7P9J904097', 1, 88.00, 'wechat', 'pending', 'vip_quarterly', NULL, NULL, '2026-04-29 00:17:43', '2026-04-29 00:17:43'),
(16, 'XMTE7PAQ9ACA3D', 1, 88.00, 'wechat', 'pending', 'vip_quarterly', NULL, NULL, '2026-04-29 00:18:26', '2026-04-29 00:18:26'),
(17, 'XMTECQ862213A8', 19, 88.00, 'wechat', 'pending', 'vip_quarterly', NULL, NULL, '2026-05-01 17:26:30', '2026-05-01 17:26:30');

-- --------------------------------------------------------

--
-- 表的结构 `products`
--

CREATE TABLE `products` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text,
  `price` decimal(10,2) NOT NULL,
  `tokens` int(11) NOT NULL DEFAULT '0',
  `duration` int(11) DEFAULT NULL,
  `type` varchar(20) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- 转存表中的数据 `products`
--

INSERT INTO `products` (`id`, `name`, `description`, `price`, `tokens`, `duration`, `type`, `is_active`, `created_at`, `updated_at`) VALUES
(1, '月度VIP', '30天VIP会员，享受所有高级功能', 0.10, 0, 30, 'vip_monthly', 1, '2026-03-24 17:27:45', '2026-03-24 20:12:47'),
(2, '季度VIP', '90天VIP会员，享受所有高级功能', 88.00, 0, 90, 'vip_quarterly', 1, '2026-03-24 17:27:45', '2026-03-24 19:36:03'),
(3, '年度VIP', '365天VIP会员，享受所有高级功能', 188.00, 0, 365, 'vip_yearly', 1, '2026-03-24 17:27:45', '2026-03-24 17:27:45');

-- --------------------------------------------------------

--
-- 表的结构 `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `nickname` varchar(100) DEFAULT NULL,
  `avatar` varchar(500) DEFAULT NULL,
  `user_group` varchar(20) DEFAULT 'free',
  `vip_expire_at` datetime DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- 转存表中的数据 `users`
--

INSERT INTO `users` (`id`, `email`, `password_hash`, `nickname`, `avatar`, `user_group`, `vip_expire_at`, `last_login_at`, `created_at`, `updated_at`) VALUES
(1, '82413405@qq.com', '$2y$10$d4AXW3ftkt9eDzOtJlgLU.nPxGOThZk9KlqeBpLy8.NonaoK8YTxu', '82413405', NULL, 'vip', '2026-05-24 20:29:14', '2026-05-08 12:30:03', '2026-03-24 18:41:49', '2026-05-08 12:30:03'),
(2, '3219578691@qq.com', '$2y$10$lm8mOL0Nez6EpYz1wHFblOuxnPWJREvCHFUAAmIWJB.Pn4WIZrTHO', '3219578691', NULL, 'free', NULL, NULL, '2026-04-24 16:42:19', '2026-04-24 16:42:19'),
(3, '961268243@qq.com', '$2y$10$JygnqvFmQ4n9oxTUC5CQMulqsWnVuw6ea93eI1ViuUyX9Cbxj6ySq', '961268243', NULL, 'free', NULL, NULL, '2026-04-25 08:41:11', '2026-04-25 08:41:11'),
(4, '957434005@qq.com', '$2y$10$gcfdex6XwEDizUevVndS4eNWZb3rLKsrKYxm4rBmbC8iSq/wgaOY6', '957434005', NULL, 'free', NULL, NULL, '2026-04-25 10:47:29', '2026-04-25 10:47:29'),
(5, '66782116@qq.com', '$2y$10$SuIo5xMQtBqIkOwfmKYTTusfqtuxMabZEZy3FYFv447aujVh0FV.W', '66782116', NULL, 'free', NULL, NULL, '2026-04-25 15:22:33', '2026-04-25 15:22:33'),
(6, '761463544@qq.com', '$2y$10$cfCHTm3uyl2a63tuY3EoReCnaqip3vFHOu3vTHT3lvmxMmHVgKjxu', '761463544', NULL, 'free', NULL, NULL, '2026-04-27 11:16:31', '2026-04-27 11:16:31'),
(7, '632092396@qq.com', '$2y$10$.8dsi/YiWlE1YIz.hAQmk.JvsT4bDQVKW5A9F3ti0QuoKXLvVlCNa', '632092396', NULL, 'free', NULL, NULL, '2026-04-28 22:10:58', '2026-04-28 22:10:58'),
(8, '394791912@qq.com', '$2y$10$B27X4ML1aaxBEYUFRM1s6.x9hmY9BSoRgH1C2hVkLFNpXTcr8tO2C', '394791912', NULL, 'free', NULL, NULL, '2026-04-29 09:54:47', '2026-04-29 09:54:47'),
(9, '282957468@qq.com', '$2y$10$Y0gAtQommJpytIBmn.7r/.MyjXI4E3WGtBc3pK38cKIpUd2vcUfB.', '282957468', NULL, 'free', NULL, '2026-05-08 10:08:00', '2026-04-29 16:40:44', '2026-05-08 10:08:00'),
(10, 'lczemail123@163.com', '$2y$10$rKwI0oPoTFhGRabjpOZaF.paL.r2/GWEnw9Bwo/RCdfty9s.EuPV2', 'lczemail123', NULL, 'free', NULL, NULL, '2026-04-29 23:51:15', '2026-04-29 23:51:15'),
(11, '2273244721@qq.com', '$2y$10$RBrIAeulnin9IdMC4hUwVeoB5icypIzUGpDcYjGeXMcK0GFlHMX3O', '2273244721', NULL, 'free', NULL, NULL, '2026-04-30 09:48:05', '2026-04-30 09:48:05'),
(12, '83839551@qq.com', '$2y$10$j4h7Vfsour7Fb3BlBXSc2OSsFyktCORRpdZ6RRwRiu3IBb94GaDwi', '83839551', NULL, 'free', NULL, NULL, '2026-04-30 10:11:07', '2026-04-30 10:11:07'),
(13, '393818347@qq.com', '$2y$10$AqEx.4CwsyLKSuToSXC8E.4Ppajpb69TglXbRoS4B0miV8ZK0qB7y', '393818347', NULL, 'free', NULL, NULL, '2026-04-30 11:50:23', '2026-04-30 11:50:23'),
(14, '215405985@qq.com', '$2y$10$M5bTOOSQ7ihB35a18F8QW.r/evc1nmV2fqLi98/APSe6TA0iu2l9e', '215405985', NULL, 'free', NULL, NULL, '2026-04-30 13:11:27', '2026-04-30 13:11:27'),
(15, '1097336571@qq.com', '$2y$10$Xfa8RUU828Z69gKQ8VsQB.O2asac0Sk1WJRau46EFh71BBq7LdLv6', '1097336571', NULL, 'free', NULL, NULL, '2026-04-30 14:18:33', '2026-04-30 14:18:33'),
(16, 'lsgxlzh@126.com', '$2y$10$01UIlVtY0UoxR4kgPUM4nOx4qZvewpJxooG.9QRKIrfw5Kw2a3pcu', 'lsgxlzh', NULL, 'free', NULL, NULL, '2026-04-30 22:55:11', '2026-04-30 22:55:11'),
(17, '2722626419@qq.com', '$2y$10$dIKH8Il8DyfBAFl.cKTWNeaSX3MzYKV.Pu3sw85BNqCXFoNh1h8LS', '2722626419', NULL, 'free', NULL, '2026-05-04 20:03:20', '2026-05-01 00:31:04', '2026-05-04 20:03:20'),
(18, '1229172489@qq.com', '$2y$10$XMuZBJmxL6aoHjBjoF4FUuP3.vsoxZori3TCC6SL7H4Uv/Q8m5srC', '1229172489', NULL, 'free', NULL, NULL, '2026-05-01 13:54:29', '2026-05-01 13:54:29'),
(19, '1066626366@qq.com', '$2y$10$TZc9GiVxcLXQC8mHfagJDOBEF8VWRrkZY8SfWidPvs8lA7llrSXV.', '1066626366', NULL, 'free', NULL, '2026-05-08 12:24:56', '2026-05-01 16:05:43', '2026-05-08 12:24:56'),
(20, 'syk989666@gmail.com', '$2y$10$hIiWiSpneX6TjQS1uXXHW.H8/L6Mw0MM0NW8IKzYeSzjTlY47qbpm', 'syk989666', NULL, 'free', NULL, NULL, '2026-05-01 22:53:18', '2026-05-01 22:53:18'),
(21, 'liuyong867240098@163.com', '$2y$10$OjaCU0dB0liXLU/FOa9ABOVINQMNnWj85z.IMnLj.nD6cxQ12ttua', 'liuyong867240098', NULL, 'free', NULL, '2026-05-08 00:19:12', '2026-05-02 00:13:17', '2026-05-08 00:19:12'),
(22, '1960779463@qq.com', '$2y$10$7NYIk1jJjMYNmrJdXc.Lse8NPoYeTclD/mlsAySjUbtROE7Kmvms2', '1960779463', NULL, 'free', NULL, '2026-05-06 20:56:28', '2026-05-02 10:01:36', '2026-05-06 20:56:28'),
(23, '2916639540@qq.com', '$2y$10$.Ps3rc1TJpfkwm6vs/d45OtFbBJ8.YYkwQlPXJYWwgBo30C6//AXS', '2916639540', NULL, 'free', NULL, '2026-05-02 17:42:53', '2026-05-02 15:34:36', '2026-05-02 17:42:53'),
(24, '3087695954@qq.com', '$2y$10$.LnVZS/bTapAB3OslcuzrOaF3QQ3AaPfxZZZ2IsZ7wylTSEcG1ULG', '3087695954', NULL, 'free', NULL, NULL, '2026-05-03 13:32:40', '2026-05-03 13:32:40'),
(25, '2261008927@qq.com', '$2y$10$1aDFGrS3kEzztTrAG4iLFOvDYYAox8Rm7VpkwG09niyWIhfZ861Cq', '2261008927', NULL, 'free', NULL, '2026-05-03 20:12:51', '2026-05-03 15:49:23', '2026-05-03 20:12:51'),
(26, '13772723@qq.com', '$2y$10$2YF5EszhJNPyzSCLOLdsuuvyJ/m7kc5hVKbNcLLyBy2o4fAPRkmPu', '13772723', NULL, 'free', NULL, '2026-05-04 16:54:36', '2026-05-03 17:40:04', '2026-05-04 16:54:36'),
(27, '260428251@qq.com', '$2y$10$XuNsNe9fCxCbqNbqCMqPcOvXTNhLZF7NkCE0YKaoRwGKVA1i77gFS', '260428251', NULL, 'free', NULL, '2026-05-06 13:41:16', '2026-05-03 22:19:14', '2026-05-06 13:41:16'),
(28, '397630772@qq.com', '$2y$10$IMXxd2GdZ2FeNGQ42IdHhefuR6rUqecaHQ2Dldq/VOdtiaC9wAbne', '397630772', NULL, 'free', NULL, NULL, '2026-05-04 09:46:16', '2026-05-04 09:46:16'),
(29, '1051144916@qq.com', '$2y$10$oplvU6cdPZGJ8K9iDdAD2e2fKT2H9CTOcXNaTQ.cVRx22qT.a81JK', '1051144916', NULL, 'free', NULL, '2026-05-08 09:55:04', '2026-05-06 07:48:54', '2026-05-08 09:55:04'),
(30, '1255158725@qq.com', '$2y$10$wGtpSi6tuFz6uiVdIczbd.xI5GJjxnh2.1AJ91HONAs5InPSVvHkC', '1255158725', NULL, 'free', NULL, '2026-05-06 08:45:04', '2026-05-06 08:37:10', '2026-05-06 08:45:04'),
(31, '2011965895@qq.com', '$2y$10$H/fBfeFwtzFP8XplWBdQ..mN/IYzADUaXidq/K9eZIfdd7eGoFA9a', '2011965895', NULL, 'free', NULL, '2026-05-07 11:01:06', '2026-05-06 20:28:14', '2026-05-07 11:01:06'),
(32, 'mov2oi8vh115@aniimate.net', '$2y$10$h6MvCf5ITYMSNpx8WfB.YeJBlwtKMmqPZ6Zf5z8Nu5XRbovyhaL3a', 'mov2oi8vh115', NULL, 'free', NULL, NULL, '2026-05-07 13:56:16', '2026-05-07 13:56:16'),
(33, '2275201933@qq.com', '$2y$10$8YWHdyibva.RQzUzirVrWOOzlnLWE6pDHej2AWZ1BQf2JP8Z/Egk.', '2275201933', NULL, 'free', NULL, NULL, '2026-05-07 18:07:03', '2026-05-07 18:07:03'),
(34, '821119601@qq.com', '$2y$10$IeQw6y1ccfdgS4TddvtlAuaettrd/4PhW3TcGuWMHuyEjfRnjSLwO', '821119601', NULL, 'free', NULL, '2026-05-07 22:39:25', '2026-05-07 22:33:56', '2026-05-07 22:39:25'),
(35, '1104748357@qq.com', '$2y$10$tyZj1Z67ZJYyATmS1CSH6enQcZ3g1vmtwQ4L8WxmGeOFzBiRS5gEG', '1104748357', NULL, 'free', NULL, '2026-05-08 10:14:40', '2026-05-08 09:48:18', '2026-05-08 10:14:40');

-- --------------------------------------------------------

--
-- 表的结构 `verify_codes`
--

CREATE TABLE `verify_codes` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `code` varchar(10) NOT NULL,
  `type` varchar(20) DEFAULT 'register',
  `expires_at` datetime NOT NULL,
  `used` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- 转存表中的数据 `verify_codes`
--

INSERT INTO `verify_codes` (`id`, `email`, `code`, `type`, `expires_at`, `used`, `created_at`) VALUES
(1, '82413405@qq.com', '918789', 'register', '2026-03-24 18:31:04', 0, '2026-03-24 18:26:04'),
(2, 'test123@qq.com', '432133', 'register', '2026-03-24 18:38:30', 0, '2026-03-24 18:33:30'),
(3, 'test26663@qq.com', '717167', 'register', '2026-03-24 18:39:44', 0, '2026-03-24 18:34:44'),
(4, 'test73266@qq.com', '848301', 'register', '2026-03-24 18:43:58', 0, '2026-03-24 18:38:58'),
(5, '2200186268@qq.com', '414299', 'register', '2026-03-24 18:44:33', 0, '2026-03-24 18:39:33'),
(6, '82413405@qq.com', '550684', 'register', '2026-03-24 18:46:25', 1, '2026-03-24 18:41:25'),
(7, '82413405@qq.com', '530629', 'reset', '2026-03-24 19:32:36', 0, '2026-03-24 19:27:36'),
(8, '82413405@qq.com', '704414', 'reset', '2026-03-24 19:38:13', 1, '2026-03-24 19:33:13'),
(9, '82413405@qq.com', '774061', 'reset', '2026-04-10 20:51:44', 1, '2026-04-10 20:46:44'),
(10, 'a110125@qq.com', '240106', 'register', '2026-04-24 16:45:01', 0, '2026-04-24 16:40:01'),
(11, 'a110125@qq.com', '026718', 'register', '2026-04-24 16:46:03', 0, '2026-04-24 16:41:03'),
(12, '3219578691@qq.com', '714927', 'register', '2026-04-24 16:47:06', 1, '2026-04-24 16:42:06'),
(13, '961268243@qq.com', '028934', 'register', '2026-04-25 08:45:57', 1, '2026-04-25 08:40:57'),
(14, '957434005@qq.com', '930063', 'register', '2026-04-25 10:51:23', 1, '2026-04-25 10:46:23'),
(15, '66782116@qq.com', '108202', 'register', '2026-04-25 15:27:12', 1, '2026-04-25 15:22:12'),
(16, '761463544@qq.com', '736295', 'register', '2026-04-27 11:21:20', 1, '2026-04-27 11:16:20'),
(17, '632092396@qq.com', '642743', 'register', '2026-04-28 22:15:45', 1, '2026-04-28 22:10:45'),
(18, '394791912@qq.com', '072590', 'register', '2026-04-29 09:59:22', 1, '2026-04-29 09:54:22'),
(19, '282957468@qq.com', '705939', 'register', '2026-04-29 16:45:23', 1, '2026-04-29 16:40:23'),
(20, 'lczemail123@163.com', '458516', 'register', '2026-04-29 23:55:47', 1, '2026-04-29 23:50:47'),
(21, '2273244721@qq.com', '918613', 'register', '2026-04-30 09:52:47', 1, '2026-04-30 09:47:47'),
(22, '83839551@qq.com', '254605', 'register', '2026-04-30 10:15:51', 1, '2026-04-30 10:10:51'),
(23, '393818347@qq.com', '321426', 'register', '2026-04-30 11:55:01', 1, '2026-04-30 11:50:01'),
(24, '215405985@qq.com', '393146', 'register', '2026-04-30 13:16:03', 1, '2026-04-30 13:11:03'),
(25, '1097336571@qq.com', '380968', 'register', '2026-04-30 14:23:07', 1, '2026-04-30 14:18:07'),
(26, 'lsgxlzh@126.com', '707112', 'register', '2026-04-30 22:59:14', 1, '2026-04-30 22:54:14'),
(27, '2722626419@qq.com', '912499', 'register', '2026-05-01 00:35:45', 1, '2026-05-01 00:30:45'),
(28, '1229172489@qq.com', '336531', 'register', '2026-05-01 13:59:17', 1, '2026-05-01 13:54:17'),
(29, '1066626366@qq.com', '056772', 'register', '2026-05-01 16:10:27', 1, '2026-05-01 16:05:27'),
(30, 'syk989666@gmail.com', '808331', 'register', '2026-05-01 22:57:56', 1, '2026-05-01 22:52:56'),
(31, 'liuyong867240098@163.com', '189450', 'register', '2026-05-02 00:17:24', 1, '2026-05-02 00:12:24'),
(32, '1960779463@qq.com', '372493', 'register', '2026-05-02 10:06:23', 1, '2026-05-02 10:01:23'),
(33, '2916639540@qq.com', '146928', 'register', '2026-05-02 15:39:14', 1, '2026-05-02 15:34:14'),
(34, '3087695954@qq.com', '952756', 'register', '2026-05-03 13:37:19', 1, '2026-05-03 13:32:19'),
(35, '2261008927@qq.com', '705278', 'register', '2026-05-03 15:54:03', 1, '2026-05-03 15:49:03'),
(36, '13772723@qq.com', '122235', 'register', '2026-05-03 17:44:47', 1, '2026-05-03 17:39:47'),
(37, '260428251@qq.com', '460067', 'register', '2026-05-03 22:23:49', 1, '2026-05-03 22:18:49'),
(38, '397630772@qq.com', '491932', 'register', '2026-05-04 09:50:26', 1, '2026-05-04 09:45:26'),
(39, '1051144916@qq.com', '988202', 'register', '2026-05-06 07:53:40', 1, '2026-05-06 07:48:40'),
(40, '1255158725@qq.com', '064580', 'register', '2026-05-06 08:41:50', 1, '2026-05-06 08:36:50'),
(41, '2011965895@qq.com', '909588', 'register', '2026-05-06 20:32:25', 1, '2026-05-06 20:27:25'),
(42, 'mov2oi8vh115@aniimate.net', '489028', 'register', '2026-05-07 14:00:59', 1, '2026-05-07 13:55:59'),
(43, '2275201933@qq.com', '802101', 'register', '2026-05-07 18:11:42', 1, '2026-05-07 18:06:42'),
(44, '821119601@qq.com', '626751', 'register', '2026-05-07 22:38:44', 1, '2026-05-07 22:33:44'),
(45, '1104748357@qq.com', '146575', 'register', '2026-05-08 09:52:53', 1, '2026-05-08 09:47:53');

--
-- 转储表的索引
--

--
-- 表的索引 `api_keys`
--
ALTER TABLE `api_keys`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `api_key` (`api_key`),
  ADD KEY `user_id` (`user_id`);

--
-- 表的索引 `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `order_no` (`order_no`),
  ADD KEY `user_id` (`user_id`);

--
-- 表的索引 `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`);

--
-- 表的索引 `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- 表的索引 `verify_codes`
--
ALTER TABLE `verify_codes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `email` (`email`),
  ADD KEY `expires_at` (`expires_at`);

--
-- 在导出的表使用AUTO_INCREMENT
--

--
-- 使用表AUTO_INCREMENT `api_keys`
--
ALTER TABLE `api_keys`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=36;

--
-- 使用表AUTO_INCREMENT `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- 使用表AUTO_INCREMENT `products`
--
ALTER TABLE `products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- 使用表AUTO_INCREMENT `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=36;

--
-- 使用表AUTO_INCREMENT `verify_codes`
--
ALTER TABLE `verify_codes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=46;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
