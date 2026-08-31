import type { DeepStringify } from "../deep-stringify";
import type source from "./identities.en";

const messages: DeepStringify<typeof source> = {
  identities: {
    eyebrow: "هویت",
    title: "هویت‌ها",
    subtitle: "یک ردیف برای هر هویت مشاهده‌شده در وب، ویجت و تلگرام — نام‌ها پس از ثبت بازدیدکننده به‌عنوان سرنخ تکمیل می‌شوند.",
    notConfiguredTitle: "Supabase پیکربندی نشده",
    notConfiguredBody: "برای مشاهدهٔ بازدیدکنندگان در این‌جا، NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY را تنظیم کنید.",
    columnName: "نام",
    columnChannel: "کانال",
    columnIdentifier: "شناسه",
    columnFirstSeen: "اولین مشاهده",
    emptyTitle: "هنوز بازدیدکننده‌ای وجود ندارد",
    emptyBody: "به‌محض این‌که کسی گفتگو را باز کند، این‌جا نمایش داده می‌شود.",
  },
};

export default messages;
