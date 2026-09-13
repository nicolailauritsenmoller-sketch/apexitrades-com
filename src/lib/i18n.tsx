import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Lightweight global i18n provider.
 * - Language code persists in localStorage ("velocity.lang")
 * - Applies <html lang> and dir="rtl" for Arabic
 * - Any component can read strings with useT()
 */

export const LANG_KEY = "velocity.lang";

export const LANGUAGES = [
  { id: "en", label: "English", native: "English" },
  { id: "es", label: "Spanish", native: "Español" },
  { id: "fr", label: "French", native: "Français" },
  { id: "de", label: "German", native: "Deutsch" },
  { id: "pt", label: "Portuguese", native: "Português" },
  { id: "it", label: "Italian", native: "Italiano" },
  { id: "zh", label: "Chinese (Simplified)", native: "简体中文" },
  { id: "ja", label: "Japanese", native: "日本語" },
  { id: "ko", label: "Korean", native: "한국어" },
  { id: "ar", label: "Arabic", native: "العربية" },
  { id: "ru", label: "Russian", native: "Русский" },
  { id: "tr", label: "Turkish", native: "Türkçe" },
  { id: "hi", label: "Hindi", native: "हिन्दी" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["id"];
export const RTL_LANGS: LangCode[] = ["ar"];

const en = {
  "nav.home": "Home",
  "nav.portfolio": "Portfolio",
  "nav.markets": "Markets",
  "nav.trade": "Trade",
  "nav.wallet": "Assets",
  "nav.profile": "Profile",
  "nav.admin": "Control Center",
  "nav.signOut": "Sign out",
  "nav.liveAccount": "Live account",
  "common.search": "Search",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.confirm": "Confirm",
  "common.loading": "Loading",
  "common.total": "Total",
  "common.balance": "Balance",
  "common.price": "Price",
  "common.change24h": "24h change",
  "common.amount": "Amount",
  "common.asset": "Asset",
  "common.value": "Value",
  "common.settings": "Settings",
  "common.support": "Support",
  "common.language": "Language",
  "common.theme": "Theme",
  "common.currency": "Display currency",
  "common.preferences": "Preferences",
  "common.appearance": "Appearance",
  "dashboard.title": "Home",
  "dashboard.totalFunds": "Total funds",
  "dashboard.buy": "Buy",
  "dashboard.swap": "Swap",
  "dashboard.deposit": "Deposit",
  "dashboard.withdraw": "Withdraw",
  "dashboard.watchlist": "Watchlist",
  "dashboard.news": "Market news",
  "portfolio.title": "Portfolio",
  "portfolio.totalValue": "Total portfolio value",
  "portfolio.performance": "Performance",
  "portfolio.allocation": "Asset allocation",
  "portfolio.positions": "Open positions",
  "portfolio.history": "Trade history",
  "markets.title": "Markets",
  "markets.crypto": "Crypto",
  "markets.stocks": "Stocks",
  "markets.forex": "Forex",
  "markets.futures": "Futures",
  "markets.gold": "Gold",
  "trade.title": "Trade",
  "trade.buyLong": "Buy Long",
  "trade.sellShort": "Sell Short",
  "trade.orderBook": "Order book",
  "trade.leverage": "Leverage",
  "wallet.title": "Assets",
  "wallet.totalBalance": "Total balance",
  "wallet.hideZero": "Hide 0 balance",
  "profile.title": "Profile",
  "profile.verification": "Account verification",
  "profile.security": "Security center",
  "profile.referrals": "Referral program",
  "profile.help": "Help center",
  "profile.contact": "Contact support",
  "prefs.languageHelp": "Interface language preference.",
  "prefs.currencyHelp": "Portfolio values are converted for display only.",
  "prefs.themeHelp": "Switch between the light and dark terminal.",
} as const;

export type TranslationKey = keyof typeof en;
type Dict = Partial<Record<TranslationKey, string>>;

const es: Dict = {
  "nav.home": "Inicio", "nav.portfolio": "Cartera", "nav.markets": "Mercados", "nav.trade": "Operar", "nav.wallet": "Billetera", "nav.profile": "Perfil", "nav.admin": "Centro de control", "nav.signOut": "Cerrar sesión", "nav.liveAccount": "Cuenta real",
  "nav.assets": "Activos",
  "common.search": "Buscar", "common.save": "Guardar", "common.cancel": "Cancelar", "common.close": "Cerrar", "common.confirm": "Confirmar", "common.loading": "Cargando", "common.total": "Total", "common.balance": "Saldo", "common.price": "Precio", "common.change24h": "Cambio 24h", "common.amount": "Importe", "common.asset": "Activo", "common.value": "Valor", "common.settings": "Ajustes", "common.support": "Soporte", "common.language": "Idioma", "common.theme": "Tema", "common.currency": "Moneda de visualización", "common.preferences": "Preferencias", "common.appearance": "Apariencia",
  "dashboard.title": "Inicio", "dashboard.totalFunds": "Fondos totales", "dashboard.buy": "Comprar", "dashboard.swap": "Intercambiar", "dashboard.deposit": "Depositar", "dashboard.withdraw": "Retirar", "dashboard.watchlist": "Lista de seguimiento", "dashboard.news": "Noticias del mercado",
  "portfolio.title": "Cartera", "portfolio.totalValue": "Valor total de la cartera", "portfolio.performance": "Rendimiento", "portfolio.allocation": "Distribución de activos", "portfolio.positions": "Posiciones abiertas", "portfolio.history": "Historial de operaciones",
  "markets.title": "Mercados", "markets.crypto": "Cripto", "markets.stocks": "Acciones", "markets.forex": "Forex", "markets.futures": "Futuros", "markets.gold": "Oro",
  "trade.title": "Operar", "trade.buyLong": "Comprar largo", "trade.sellShort": "Vender corto", "trade.orderBook": "Libro de órdenes", "trade.leverage": "Apalancamiento",
  "wallet.title": "Billetera", "wallet.totalBalance": "Saldo total", "wallet.hideZero": "Ocultar saldo 0",
  "profile.title": "Perfil", "profile.verification": "Verificación de cuenta", "profile.security": "Centro de seguridad", "profile.referrals": "Programa de referidos", "profile.help": "Centro de ayuda", "profile.contact": "Contactar soporte",
  "prefs.languageHelp": "Preferencia de idioma de la interfaz.", "prefs.currencyHelp": "Los valores se convierten solo para su visualización.", "prefs.themeHelp": "Cambia entre el terminal claro y oscuro.",
};

const fr: Dict = {
  "nav.home": "Accueil", "nav.portfolio": "Portefeuille", "nav.markets": "Marchés", "nav.trade": "Trader", "nav.wallet": "Portemonnaie", "nav.profile": "Profil", "nav.admin": "Centre de contrôle", "nav.signOut": "Déconnexion", "nav.liveAccount": "Compte réel",
  "nav.assets": "Actifs",
  "common.search": "Rechercher", "common.save": "Enregistrer", "common.cancel": "Annuler", "common.close": "Fermer", "common.confirm": "Confirmer", "common.loading": "Chargement", "common.total": "Total", "common.balance": "Solde", "common.price": "Prix", "common.change24h": "Variation 24h", "common.amount": "Montant", "common.asset": "Actif", "common.value": "Valeur", "common.settings": "Paramètres", "common.support": "Assistance", "common.language": "Langue", "common.theme": "Thème", "common.currency": "Devise d'affichage", "common.preferences": "Préférences", "common.appearance": "Apparence",
  "dashboard.title": "Accueil", "dashboard.totalFunds": "Fonds totaux", "dashboard.buy": "Acheter", "dashboard.swap": "Échanger", "dashboard.deposit": "Dépôt", "dashboard.withdraw": "Retrait", "dashboard.watchlist": "Liste de suivi", "dashboard.news": "Actualités du marché",
  "portfolio.title": "Portefeuille", "portfolio.totalValue": "Valeur totale du portefeuille", "portfolio.performance": "Performance", "portfolio.allocation": "Répartition des actifs", "portfolio.positions": "Positions ouvertes", "portfolio.history": "Historique des trades",
  "markets.title": "Marchés", "markets.crypto": "Crypto", "markets.stocks": "Actions", "markets.forex": "Forex", "markets.futures": "Futures", "markets.gold": "Or",
  "trade.title": "Trader", "trade.buyLong": "Acheter (long)", "trade.sellShort": "Vendre (short)", "trade.orderBook": "Carnet d'ordres", "trade.leverage": "Levier",
  "wallet.title": "Portemonnaie", "wallet.totalBalance": "Solde total", "wallet.hideZero": "Masquer les soldes à 0",
  "profile.title": "Profil", "profile.verification": "Vérification du compte", "profile.security": "Centre de sécurité", "profile.referrals": "Programme de parrainage", "profile.help": "Centre d'aide", "profile.contact": "Contacter l'assistance",
  "prefs.languageHelp": "Préférence de langue de l'interface.", "prefs.currencyHelp": "Les valeurs sont converties uniquement pour l'affichage.", "prefs.themeHelp": "Basculez entre le terminal clair et sombre.",
};

const de: Dict = {
  "nav.home": "Start", "nav.portfolio": "Portfolio", "nav.markets": "Märkte", "nav.trade": "Handeln", "nav.wallet": "Wallet", "nav.profile": "Profil", "nav.admin": "Kontrollzentrum", "nav.signOut": "Abmelden", "nav.liveAccount": "Echtkonto",
  "nav.assets": "Vermögenswerte",
  "common.search": "Suchen", "common.save": "Speichern", "common.cancel": "Abbrechen", "common.close": "Schließen", "common.confirm": "Bestätigen", "common.loading": "Lädt", "common.total": "Gesamt", "common.balance": "Guthaben", "common.price": "Preis", "common.change24h": "24-Std-Änderung", "common.amount": "Betrag", "common.asset": "Wert", "common.value": "Wert", "common.settings": "Einstellungen", "common.support": "Support", "common.language": "Sprache", "common.theme": "Design", "common.currency": "Anzeigewährung", "common.preferences": "Einstellungen", "common.appearance": "Erscheinungsbild",
  "dashboard.title": "Start", "dashboard.totalFunds": "Gesamtguthaben", "dashboard.buy": "Kaufen", "dashboard.swap": "Tauschen", "dashboard.deposit": "Einzahlen", "dashboard.withdraw": "Auszahlen", "dashboard.watchlist": "Watchlist", "dashboard.news": "Marktnachrichten",
  "portfolio.title": "Portfolio", "portfolio.totalValue": "Gesamter Portfoliowert", "portfolio.performance": "Wertentwicklung", "portfolio.allocation": "Vermögensaufteilung", "portfolio.positions": "Offene Positionen", "portfolio.history": "Handelsverlauf",
  "markets.title": "Märkte", "markets.crypto": "Krypto", "markets.stocks": "Aktien", "markets.forex": "Forex", "markets.futures": "Futures", "markets.gold": "Gold",
  "trade.title": "Handeln", "trade.buyLong": "Long kaufen", "trade.sellShort": "Short verkaufen", "trade.orderBook": "Orderbuch", "trade.leverage": "Hebel",
  "wallet.title": "Wallet", "wallet.totalBalance": "Gesamtguthaben", "wallet.hideZero": "0-Guthaben ausblenden",
  "profile.title": "Profil", "profile.verification": "Kontoverifizierung", "profile.security": "Sicherheitscenter", "profile.referrals": "Empfehlungsprogramm", "profile.help": "Hilfecenter", "profile.contact": "Support kontaktieren",
  "prefs.languageHelp": "Bevorzugte Sprache der Oberfläche.", "prefs.currencyHelp": "Werte werden nur zur Anzeige umgerechnet.", "prefs.themeHelp": "Zwischen hellem und dunklem Terminal wechseln.",
};

const pt: Dict = {
  "nav.home": "Início", "nav.portfolio": "Carteira", "nav.markets": "Mercados", "nav.trade": "Negociar", "nav.wallet": "Carteira digital", "nav.profile": "Perfil", "nav.admin": "Centro de controle", "nav.signOut": "Sair", "nav.liveAccount": "Conta real",
  "nav.assets": "Ativos",
  "common.search": "Pesquisar", "common.save": "Salvar", "common.cancel": "Cancelar", "common.close": "Fechar", "common.confirm": "Confirmar", "common.loading": "Carregando", "common.total": "Total", "common.balance": "Saldo", "common.price": "Preço", "common.change24h": "Variação 24h", "common.amount": "Valor", "common.asset": "Ativo", "common.value": "Valor", "common.settings": "Configurações", "common.support": "Suporte", "common.language": "Idioma", "common.theme": "Tema", "common.currency": "Moeda de exibição", "common.preferences": "Preferências", "common.appearance": "Aparência",
  "dashboard.title": "Início", "dashboard.totalFunds": "Fundos totais", "dashboard.buy": "Comprar", "dashboard.swap": "Trocar", "dashboard.deposit": "Depositar", "dashboard.withdraw": "Sacar", "dashboard.watchlist": "Lista de observação", "dashboard.news": "Notícias do mercado",
  "portfolio.title": "Carteira", "portfolio.totalValue": "Valor total da carteira", "portfolio.performance": "Desempenho", "portfolio.allocation": "Alocação de ativos", "portfolio.positions": "Posições abertas", "portfolio.history": "Histórico de negociações",
  "markets.title": "Mercados", "markets.crypto": "Cripto", "markets.stocks": "Ações", "markets.forex": "Forex", "markets.futures": "Futuros", "markets.gold": "Ouro",
  "trade.title": "Negociar", "trade.buyLong": "Comprar comprado", "trade.sellShort": "Vender vendido", "trade.orderBook": "Livro de ofertas", "trade.leverage": "Alavancagem",
  "wallet.title": "Carteira digital", "wallet.totalBalance": "Saldo total", "wallet.hideZero": "Ocultar saldo 0",
  "profile.title": "Perfil", "profile.verification": "Verificação da conta", "profile.security": "Central de segurança", "profile.referrals": "Programa de indicação", "profile.help": "Central de ajuda", "profile.contact": "Falar com o suporte",
  "prefs.languageHelp": "Preferência de idioma da interface.", "prefs.currencyHelp": "Os valores são convertidos apenas para exibição.", "prefs.themeHelp": "Alterne entre o terminal claro e escuro.",
};

const it: Dict = {
  "nav.home": "Home", "nav.portfolio": "Portafoglio", "nav.markets": "Mercati", "nav.trade": "Opera", "nav.wallet": "Wallet", "nav.profile": "Profilo", "nav.admin": "Centro di controllo", "nav.signOut": "Esci", "nav.liveAccount": "Conto reale",
  "nav.assets": "Attività",
  "common.search": "Cerca", "common.save": "Salva", "common.cancel": "Annulla", "common.close": "Chiudi", "common.confirm": "Conferma", "common.loading": "Caricamento", "common.total": "Totale", "common.balance": "Saldo", "common.price": "Prezzo", "common.change24h": "Variazione 24h", "common.amount": "Importo", "common.asset": "Asset", "common.value": "Valore", "common.settings": "Impostazioni", "common.support": "Assistenza", "common.language": "Lingua", "common.theme": "Tema", "common.currency": "Valuta di visualizzazione", "common.preferences": "Preferenze", "common.appearance": "Aspetto",
  "dashboard.title": "Home", "dashboard.totalFunds": "Fondi totali", "dashboard.buy": "Compra", "dashboard.swap": "Scambia", "dashboard.deposit": "Deposita", "dashboard.withdraw": "Preleva", "dashboard.watchlist": "Watchlist", "dashboard.news": "Notizie di mercato",
  "portfolio.title": "Portafoglio", "portfolio.totalValue": "Valore totale del portafoglio", "portfolio.performance": "Performance", "portfolio.allocation": "Allocazione degli asset", "portfolio.positions": "Posizioni aperte", "portfolio.history": "Storico operazioni",
  "markets.title": "Mercati", "markets.crypto": "Cripto", "markets.stocks": "Azioni", "markets.forex": "Forex", "markets.futures": "Futures", "markets.gold": "Oro",
  "trade.title": "Opera", "trade.buyLong": "Compra long", "trade.sellShort": "Vendi short", "trade.orderBook": "Book ordini", "trade.leverage": "Leva",
  "wallet.title": "Wallet", "wallet.totalBalance": "Saldo totale", "wallet.hideZero": "Nascondi saldo 0",
  "profile.title": "Profilo", "profile.verification": "Verifica dell'account", "profile.security": "Centro sicurezza", "profile.referrals": "Programma referral", "profile.help": "Centro assistenza", "profile.contact": "Contatta l'assistenza",
  "prefs.languageHelp": "Lingua preferita dell'interfaccia.", "prefs.currencyHelp": "I valori sono convertiti solo per la visualizzazione.", "prefs.themeHelp": "Passa dal terminale chiaro a quello scuro.",
};

const zh: Dict = {
  "nav.home": "首页", "nav.portfolio": "投资组合", "nav.markets": "行情", "nav.trade": "交易", "nav.wallet": "钱包", "nav.profile": "我的", "nav.admin": "控制中心", "nav.signOut": "退出登录", "nav.liveAccount": "实盘账户",
  "nav.assets": "资产",
  "common.search": "搜索", "common.save": "保存", "common.cancel": "取消", "common.close": "关闭", "common.confirm": "确认", "common.loading": "加载中", "common.total": "合计", "common.balance": "余额", "common.price": "价格", "common.change24h": "24小时涨跌", "common.amount": "数量", "common.asset": "资产", "common.value": "价值", "common.settings": "设置", "common.support": "客服", "common.language": "语言", "common.theme": "主题", "common.currency": "显示币种", "common.preferences": "偏好设置", "common.appearance": "外观",
  "dashboard.title": "首页", "dashboard.totalFunds": "总资金", "dashboard.buy": "买入", "dashboard.swap": "兑换", "dashboard.deposit": "充值", "dashboard.withdraw": "提现", "dashboard.watchlist": "自选", "dashboard.news": "市场资讯",
  "portfolio.title": "投资组合", "portfolio.totalValue": "投资组合总价值", "portfolio.performance": "收益表现", "portfolio.allocation": "资产配置", "portfolio.positions": "持仓", "portfolio.history": "交易记录",
  "markets.title": "行情", "markets.crypto": "加密货币", "markets.stocks": "股票", "markets.forex": "外汇", "markets.futures": "期货", "markets.gold": "黄金",
  "trade.title": "交易", "trade.buyLong": "买入做多", "trade.sellShort": "卖出做空", "trade.orderBook": "订单簿", "trade.leverage": "杠杆",
  "wallet.title": "钱包", "wallet.totalBalance": "总余额", "wallet.hideZero": "隐藏零余额",
  "profile.title": "我的", "profile.verification": "身份认证", "profile.security": "安全中心", "profile.referrals": "推荐计划", "profile.help": "帮助中心", "profile.contact": "联系客服",
  "prefs.languageHelp": "界面语言偏好。", "prefs.currencyHelp": "资产价值仅用于显示换算。", "prefs.themeHelp": "在浅色与深色终端之间切换。",
};

const ja: Dict = {
  "nav.home": "ホーム", "nav.portfolio": "ポートフォリオ", "nav.markets": "マーケット", "nav.trade": "取引", "nav.wallet": "ウォレット", "nav.profile": "プロフィール", "nav.admin": "コントロールセンター", "nav.signOut": "ログアウト", "nav.liveAccount": "ライブ口座",
  "nav.assets": "資産",
  "common.search": "検索", "common.save": "保存", "common.cancel": "キャンセル", "common.close": "閉じる", "common.confirm": "確認", "common.loading": "読み込み中", "common.total": "合計", "common.balance": "残高", "common.price": "価格", "common.change24h": "24時間変動", "common.amount": "数量", "common.asset": "資産", "common.value": "評価額", "common.settings": "設定", "common.support": "サポート", "common.language": "言語", "common.theme": "テーマ", "common.currency": "表示通貨", "common.preferences": "環境設定", "common.appearance": "外観",
  "dashboard.title": "ホーム", "dashboard.totalFunds": "総資金", "dashboard.buy": "購入", "dashboard.swap": "スワップ", "dashboard.deposit": "入金", "dashboard.withdraw": "出金", "dashboard.watchlist": "ウォッチリスト", "dashboard.news": "マーケットニュース",
  "portfolio.title": "ポートフォリオ", "portfolio.totalValue": "ポートフォリオ総額", "portfolio.performance": "パフォーマンス", "portfolio.allocation": "資産配分", "portfolio.positions": "保有ポジション", "portfolio.history": "取引履歴",
  "markets.title": "マーケット", "markets.crypto": "暗号資産", "markets.stocks": "株式", "markets.forex": "FX", "markets.futures": "先物", "markets.gold": "ゴールド",
  "trade.title": "取引", "trade.buyLong": "買い（ロング）", "trade.sellShort": "売り（ショート）", "trade.orderBook": "板情報", "trade.leverage": "レバレッジ",
  "wallet.title": "ウォレット", "wallet.totalBalance": "総残高", "wallet.hideZero": "残高0を非表示",
  "profile.title": "プロフィール", "profile.verification": "本人確認", "profile.security": "セキュリティセンター", "profile.referrals": "紹介プログラム", "profile.help": "ヘルプセンター", "profile.contact": "サポートに連絡",
  "prefs.languageHelp": "インターフェースの言語設定。", "prefs.currencyHelp": "評価額は表示用に換算されます。", "prefs.themeHelp": "ライトとダークの端末表示を切り替えます。",
};

const ko: Dict = {
  "nav.home": "홈", "nav.portfolio": "포트폴리오", "nav.markets": "마켓", "nav.trade": "거래", "nav.wallet": "지갑", "nav.profile": "프로필", "nav.admin": "제어 센터", "nav.signOut": "로그아웃", "nav.liveAccount": "실계좌",
  "nav.assets": "자산",
  "common.search": "검색", "common.save": "저장", "common.cancel": "취소", "common.close": "닫기", "common.confirm": "확인", "common.loading": "불러오는 중", "common.total": "합계", "common.balance": "잔액", "common.price": "가격", "common.change24h": "24시간 변동", "common.amount": "수량", "common.asset": "자산", "common.value": "평가액", "common.settings": "설정", "common.support": "고객지원", "common.language": "언어", "common.theme": "테마", "common.currency": "표시 통화", "common.preferences": "환경설정", "common.appearance": "화면",
  "dashboard.title": "홈", "dashboard.totalFunds": "총 자금", "dashboard.buy": "구매", "dashboard.swap": "스왑", "dashboard.deposit": "입금", "dashboard.withdraw": "출금", "dashboard.watchlist": "관심목록", "dashboard.news": "마켓 뉴스",
  "portfolio.title": "포트폴리오", "portfolio.totalValue": "총 포트폴리오 가치", "portfolio.performance": "수익률", "portfolio.allocation": "자산 배분", "portfolio.positions": "보유 포지션", "portfolio.history": "거래 내역",
  "markets.title": "마켓", "markets.crypto": "가상자산", "markets.stocks": "주식", "markets.forex": "외환", "markets.futures": "선물", "markets.gold": "금",
  "trade.title": "거래", "trade.buyLong": "롱 매수", "trade.sellShort": "숏 매도", "trade.orderBook": "호가창", "trade.leverage": "레버리지",
  "wallet.title": "지갑", "wallet.totalBalance": "총 잔액", "wallet.hideZero": "0 잔액 숨기기",
  "profile.title": "프로필", "profile.verification": "계정 인증", "profile.security": "보안 센터", "profile.referrals": "추천 프로그램", "profile.help": "고객센터", "profile.contact": "지원 문의",
  "prefs.languageHelp": "인터페이스 언어 설정입니다.", "prefs.currencyHelp": "자산 가치는 표시용으로만 환산됩니다.", "prefs.themeHelp": "라이트와 다크 터미널을 전환합니다.",
};

const ar: Dict = {
  "nav.home": "الرئيسية", "nav.portfolio": "المحفظة الاستثمارية", "nav.markets": "الأسواق", "nav.trade": "التداول", "nav.wallet": "المحفظة", "nav.profile": "الملف الشخصي", "nav.admin": "مركز التحكم", "nav.signOut": "تسجيل الخروج", "nav.liveAccount": "حساب حقيقي",
  "nav.assets": "الأصول",
  "common.search": "بحث", "common.save": "حفظ", "common.cancel": "إلغاء", "common.close": "إغلاق", "common.confirm": "تأكيد", "common.loading": "جارٍ التحميل", "common.total": "الإجمالي", "common.balance": "الرصيد", "common.price": "السعر", "common.change24h": "تغير 24 ساعة", "common.amount": "المبلغ", "common.asset": "الأصل", "common.value": "القيمة", "common.settings": "الإعدادات", "common.support": "الدعم", "common.language": "اللغة", "common.theme": "المظهر", "common.currency": "عملة العرض", "common.preferences": "التفضيلات", "common.appearance": "المظهر",
  "dashboard.title": "الرئيسية", "dashboard.totalFunds": "إجمالي الأموال", "dashboard.buy": "شراء", "dashboard.swap": "مبادلة", "dashboard.deposit": "إيداع", "dashboard.withdraw": "سحب", "dashboard.watchlist": "قائمة المتابعة", "dashboard.news": "أخبار السوق",
  "portfolio.title": "المحفظة الاستثمارية", "portfolio.totalValue": "إجمالي قيمة المحفظة", "portfolio.performance": "الأداء", "portfolio.allocation": "توزيع الأصول", "portfolio.positions": "الصفقات المفتوحة", "portfolio.history": "سجل التداول",
  "markets.title": "الأسواق", "markets.crypto": "العملات الرقمية", "markets.stocks": "الأسهم", "markets.forex": "الفوركس", "markets.futures": "العقود الآجلة", "markets.gold": "الذهب",
  "trade.title": "التداول", "trade.buyLong": "شراء طويل", "trade.sellShort": "بيع قصير", "trade.orderBook": "دفتر الأوامر", "trade.leverage": "الرافعة المالية",
  "wallet.title": "المحفظة", "wallet.totalBalance": "إجمالي الرصيد", "wallet.hideZero": "إخفاء الأرصدة الصفرية",
  "profile.title": "الملف الشخصي", "profile.verification": "توثيق الحساب", "profile.security": "مركز الأمان", "profile.referrals": "برنامج الإحالة", "profile.help": "مركز المساعدة", "profile.contact": "تواصل مع الدعم",
  "prefs.languageHelp": "تفضيل لغة الواجهة.", "prefs.currencyHelp": "يتم تحويل القيم لغرض العرض فقط.", "prefs.themeHelp": "التبديل بين الواجهة الفاتحة والداكنة.",
};

const ru: Dict = {
  "nav.home": "Главная", "nav.portfolio": "Портфель", "nav.markets": "Рынки", "nav.trade": "Торговля", "nav.wallet": "Кошелёк", "nav.profile": "Профиль", "nav.admin": "Центр управления", "nav.signOut": "Выйти", "nav.liveAccount": "Реальный счёт",
  "nav.assets": "Активы",
  "common.search": "Поиск", "common.save": "Сохранить", "common.cancel": "Отмена", "common.close": "Закрыть", "common.confirm": "Подтвердить", "common.loading": "Загрузка", "common.total": "Итого", "common.balance": "Баланс", "common.price": "Цена", "common.change24h": "Изм. за 24ч", "common.amount": "Сумма", "common.asset": "Актив", "common.value": "Стоимость", "common.settings": "Настройки", "common.support": "Поддержка", "common.language": "Язык", "common.theme": "Тема", "common.currency": "Валюта отображения", "common.preferences": "Предпочтения", "common.appearance": "Оформление",
  "dashboard.title": "Главная", "dashboard.totalFunds": "Всего средств", "dashboard.buy": "Купить", "dashboard.swap": "Обмен", "dashboard.deposit": "Пополнить", "dashboard.withdraw": "Вывести", "dashboard.watchlist": "Избранное", "dashboard.news": "Новости рынка",
  "portfolio.title": "Портфель", "portfolio.totalValue": "Общая стоимость портфеля", "portfolio.performance": "Доходность", "portfolio.allocation": "Распределение активов", "portfolio.positions": "Открытые позиции", "portfolio.history": "История сделок",
  "markets.title": "Рынки", "markets.crypto": "Криптовалюты", "markets.stocks": "Акции", "markets.forex": "Форекс", "markets.futures": "Фьючерсы", "markets.gold": "Золото",
  "trade.title": "Торговля", "trade.buyLong": "Купить (лонг)", "trade.sellShort": "Продать (шорт)", "trade.orderBook": "Стакан заявок", "trade.leverage": "Кредитное плечо",
  "wallet.title": "Кошелёк", "wallet.totalBalance": "Общий баланс", "wallet.hideZero": "Скрыть нулевые балансы",
  "profile.title": "Профиль", "profile.verification": "Верификация аккаунта", "profile.security": "Центр безопасности", "profile.referrals": "Реферальная программа", "profile.help": "Центр помощи", "profile.contact": "Связаться с поддержкой",
  "prefs.languageHelp": "Предпочитаемый язык интерфейса.", "prefs.currencyHelp": "Значения конвертируются только для отображения.", "prefs.themeHelp": "Переключение между светлым и тёмным терминалом.",
};

const tr: Dict = {
  "nav.home": "Ana sayfa", "nav.portfolio": "Portföy", "nav.markets": "Piyasalar", "nav.trade": "İşlem", "nav.wallet": "Cüzdan", "nav.profile": "Profil", "nav.admin": "Kontrol merkezi", "nav.signOut": "Çıkış yap", "nav.liveAccount": "Gerçek hesap",
  "nav.assets": "Varlıklar",
  "common.search": "Ara", "common.save": "Kaydet", "common.cancel": "İptal", "common.close": "Kapat", "common.confirm": "Onayla", "common.loading": "Yükleniyor", "common.total": "Toplam", "common.balance": "Bakiye", "common.price": "Fiyat", "common.change24h": "24s değişim", "common.amount": "Tutar", "common.asset": "Varlık", "common.value": "Değer", "common.settings": "Ayarlar", "common.support": "Destek", "common.language": "Dil", "common.theme": "Tema", "common.currency": "Görüntüleme para birimi", "common.preferences": "Tercihler", "common.appearance": "Görünüm",
  "dashboard.title": "Ana sayfa", "dashboard.totalFunds": "Toplam fon", "dashboard.buy": "Satın al", "dashboard.swap": "Takas", "dashboard.deposit": "Yatır", "dashboard.withdraw": "Çek", "dashboard.watchlist": "İzleme listesi", "dashboard.news": "Piyasa haberleri",
  "portfolio.title": "Portföy", "portfolio.totalValue": "Toplam portföy değeri", "portfolio.performance": "Performans", "portfolio.allocation": "Varlık dağılımı", "portfolio.positions": "Açık pozisyonlar", "portfolio.history": "İşlem geçmişi",
  "markets.title": "Piyasalar", "markets.crypto": "Kripto", "markets.stocks": "Hisseler", "markets.forex": "Forex", "markets.futures": "Vadeli", "markets.gold": "Altın",
  "trade.title": "İşlem", "trade.buyLong": "Uzun al", "trade.sellShort": "Kısa sat", "trade.orderBook": "Emir defteri", "trade.leverage": "Kaldıraç",
  "wallet.title": "Cüzdan", "wallet.totalBalance": "Toplam bakiye", "wallet.hideZero": "0 bakiyeyi gizle",
  "profile.title": "Profil", "profile.verification": "Hesap doğrulama", "profile.security": "Güvenlik merkezi", "profile.referrals": "Referans programı", "profile.help": "Yardım merkezi", "profile.contact": "Destekle iletişime geç",
  "prefs.languageHelp": "Arayüz dili tercihi.", "prefs.currencyHelp": "Değerler yalnızca görüntüleme için dönüştürülür.", "prefs.themeHelp": "Açık ve koyu terminal arasında geçiş yapın.",
};

const hi: Dict = {
  "nav.home": "होम", "nav.portfolio": "पोर्टफोलियो", "nav.markets": "मार्केट", "nav.trade": "ट्रेड", "nav.wallet": "वॉलेट", "nav.profile": "प्रोफ़ाइल", "nav.admin": "कंट्रोल सेंटर", "nav.signOut": "साइन आउट", "nav.liveAccount": "लाइव खाता",
  "nav.assets": "संपत्तियाँ",
  "common.search": "खोजें", "common.save": "सहेजें", "common.cancel": "रद्द करें", "common.close": "बंद करें", "common.confirm": "पुष्टि करें", "common.loading": "लोड हो रहा है", "common.total": "कुल", "common.balance": "बैलेंस", "common.price": "मूल्य", "common.change24h": "24घं परिवर्तन", "common.amount": "राशि", "common.asset": "एसेट", "common.value": "मूल्य", "common.settings": "सेटिंग्स", "common.support": "सहायता", "common.language": "भाषा", "common.theme": "थीम", "common.currency": "प्रदर्शन मुद्रा", "common.preferences": "प्राथमिकताएँ", "common.appearance": "रूप",
  "dashboard.title": "होम", "dashboard.totalFunds": "कुल फंड", "dashboard.buy": "खरीदें", "dashboard.swap": "स्वैप", "dashboard.deposit": "जमा करें", "dashboard.withdraw": "निकालें", "dashboard.watchlist": "वॉचलिस्ट", "dashboard.news": "मार्केट समाचार",
  "portfolio.title": "पोर्टफोलियो", "portfolio.totalValue": "कुल पोर्टफोलियो मूल्य", "portfolio.performance": "प्रदर्शन", "portfolio.allocation": "एसेट आवंटन", "portfolio.positions": "खुली पोजिशन", "portfolio.history": "ट्रेड इतिहास",
  "markets.title": "मार्केट", "markets.crypto": "क्रिप्टो", "markets.stocks": "स्टॉक्स", "markets.forex": "फॉरेक्स", "markets.futures": "फ्यूचर्स", "markets.gold": "सोना",
  "trade.title": "ट्रेड", "trade.buyLong": "लॉन्ग खरीदें", "trade.sellShort": "शॉर्ट बेचें", "trade.orderBook": "ऑर्डर बुक", "trade.leverage": "लीवरेज",
  "wallet.title": "वॉलेट", "wallet.totalBalance": "कुल बैलेंस", "wallet.hideZero": "0 बैलेंस छिपाएँ",
  "profile.title": "प्रोफ़ाइल", "profile.verification": "खाता सत्यापन", "profile.security": "सुरक्षा केंद्र", "profile.referrals": "रेफ़रल प्रोग्राम", "profile.help": "सहायता केंद्र", "profile.contact": "सहायता से संपर्क करें",
  "prefs.languageHelp": "इंटरफ़ेस भाषा प्राथमिकता।", "prefs.currencyHelp": "मूल्य केवल प्रदर्शन हेतु परिवर्तित किए जाते हैं।", "prefs.themeHelp": "लाइट और डार्क टर्मिनल के बीच स्विच करें।",
};

const DICTS: Record<LangCode, Dict> = { en, es, fr, de, pt, it, zh, ja, ko, ar, ru, tr, hi };

/** Inline script so lang/dir are correct before hydration. */
export const langBootstrapScript = `(function(){try{var l=localStorage.getItem("${LANG_KEY}")||"en";var r=document.documentElement;r.setAttribute("lang",l);r.setAttribute("dir",l==="ar"?"rtl":"ltr");}catch(e){}})();`;

function isLang(v: unknown): v is LangCode {
  return typeof v === "string" && LANGUAGES.some((l) => l.id === v);
}

function readLang(): LangCode {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (isLang(stored)) return stored;
    // fall back to any legacy preference store
    const prefs = JSON.parse(localStorage.getItem("velocity.prefs") ?? "{}");
    if (isLang(prefs?.language)) return prefs.language;
  } catch {
    /* storage unavailable */
  }
  return "en";
}

type I18nValue = {
  lang: LangCode;
  setLang: (next: LangCode) => void;
  dir: "ltr" | "rtl";
  t: (key: TranslationKey, fallback?: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("en");

  useEffect(() => {
    setLangState(readLang());
    const onEvent = (e: Event) => setLangState((e as CustomEvent<LangCode>).detail);
    window.addEventListener("velocity:lang", onEvent);
    return () => window.removeEventListener("velocity:lang", onEvent);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("lang", lang);
    root.setAttribute("dir", RTL_LANGS.includes(lang) ? "rtl" : "ltr");
  }, [lang]);

  const setLang = useCallback((next: LangCode) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      /* storage unavailable */
    }
    window.dispatchEvent(new CustomEvent<LangCode>("velocity:lang", { detail: next }));
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dict = DICTS[lang] ?? {};
    return {
      lang,
      setLang,
      dir: RTL_LANGS.includes(lang) ? "rtl" : "ltr",
      t: (key, fallback) => dict[key] ?? en[key] ?? fallback ?? String(key),
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Safe fallback when rendered outside the provider (e.g. isolated tests).
  return {
    lang: "en",
    setLang: () => {},
    dir: "ltr",
    t: (key, fallback) => en[key] ?? fallback ?? String(key),
  };
}

/** Convenience hook: const t = useT(); t("nav.home") */
export function useT() {
  return useI18n().t;
}
