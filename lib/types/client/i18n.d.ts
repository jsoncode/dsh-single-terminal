/**
 * dsh-single-terminal —— 双语字典（zh/en），语言由宿主 locale 服务驱动。
 */
export type Lang = 'zh' | 'en';
export declare function setLang(next: Lang): void;
export declare function getLang(): Lang;
export declare function t(key: string): string;
//# sourceMappingURL=i18n.d.ts.map