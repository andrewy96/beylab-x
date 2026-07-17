"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dict, Locale } from "@/i18n";
import { supabase, MY_CITIES } from "@/lib/supabase";
import { normalizeMyPhone } from "@/lib/phone";

const inputCls =
  "w-full rounded-md border border-edge bg-panel px-3 py-2.5 text-sm outline-none transition placeholder:text-ink-dim/50 focus:border-accent";
const labelCls = "mb-1 block text-xs font-semibold text-ink-dim";

function ageFromBirthday(birthday: string): number | null {
  if (!birthday) return null;
  const birthDate = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const beforeBirthday =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function NotConfigured({ dict }: { dict: Dict }) {
  return (
    <div className="panel border-accent-2/40 p-5 text-sm text-ink-dim">
      🚧 {dict.auth.notConfigured}
    </div>
  );
}

export function LoginForm({ locale, dict }: { locale: Locale; dict: Dict }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!supabase) return <NotConfigured dict={dict} />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const e164 = normalizeMyPhone(phone);
    if (!e164) return setError(dict.auth.phoneInvalid);
    setBusy(true);
    const { error: err } = await supabase!.auth.signInWithPassword({
      phone: e164,
      password,
    });
    setBusy(false);
    if (err) return setError(dict.auth.loginFailed);
    router.push(`/${locale}/me`);
  };

  return (
    <form onSubmit={submit} className="panel space-y-4 p-6">
      <div>
        <label className={labelCls}>{dict.auth.phone}</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={dict.auth.phonePlaceholder}
          inputMode="tel"
          autoComplete="tel"
          required
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>{dict.auth.password}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className={inputCls}
        />
      </div>
      {error && <p className="text-xs font-semibold text-atk">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="clip-x w-full bg-accent px-6 py-3 font-display text-sm font-bold tracking-wider text-bg transition enabled:hover:brightness-110 disabled:opacity-50"
      >
        {dict.auth.submitLogin}
      </button>
      <p className="text-center text-xs text-ink-dim">
        {dict.auth.noAccount}{" "}
        <Link href={`/${locale}/register`} className="font-semibold text-accent hover:underline">
          {dict.auth.register}
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ locale, dict }: { locale: Locale; dict: Dict }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [birthday, setBirthday] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const age = ageFromBirthday(birthday);

  if (!supabase) return <NotConfigured dict={dict} />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const e164 = normalizeMyPhone(phone);
    if (!e164) return setError(dict.auth.phoneInvalid);
    if (password.length < 8) return setError(dict.auth.passwordMin);
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(handle)) return setError(dict.auth.handleHint);
    if (gender !== "male" && gender !== "female") return setError(dict.auth.genderRequired);
    if (age == null || age < 0 || age > 120) return setError(dict.auth.birthdayInvalid);
    setBusy(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: e164,
        password,
        handle,
        displayName,
        city,
        gender,
        birthday,
        age,
      }),
    });
    if (!res.ok) {
      setBusy(false);
      return setError(dict.auth.registerFailed);
    }
    const { error: err } = await supabase!.auth.signInWithPassword({
      phone: e164,
      password,
    });
    setBusy(false);
    if (err) return setError(dict.auth.registerFailed);
    router.push(`/${locale}/me`);
  };

  return (
    <form onSubmit={submit} className="panel space-y-4 p-6">
      <div>
        <label className={labelCls}>{dict.auth.handle}</label>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="phoenix_my"
          required
          className={inputCls}
        />
        <p className="mt-1 text-[11px] text-ink-dim">{dict.auth.handleHint}</p>
      </div>
      <div>
        <label className={labelCls}>{dict.auth.displayName}</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>{dict.auth.city}</label>
        <select value={city} onChange={(e) => setCity(e.target.value)} className={inputCls}>
          <option value="">—</option>
          {MY_CITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>{dict.auth.gender}</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as "male" | "female" | "")}
            required
            className={inputCls}
          >
            <option value="">-</option>
            <option value="male">{dict.auth.genderMale}</option>
            <option value="female">{dict.auth.genderFemale}</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{dict.auth.birthday}</label>
          <input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            required
            className={inputCls}
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>{dict.auth.age}</label>
        <input
          value={age == null ? "" : age}
          readOnly
          aria-readonly="true"
          placeholder={dict.auth.ageAuto}
          className={`${inputCls} text-ink-dim`}
        />
      </div>
      <div>
        <label className={labelCls}>{dict.auth.phone}</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={dict.auth.phonePlaceholder}
          inputMode="tel"
          autoComplete="tel"
          required
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>{dict.auth.password}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
          className={inputCls}
        />
        <p className="mt-1 text-[11px] text-ink-dim">{dict.auth.passwordMin}</p>
      </div>
      {error && <p className="text-xs font-semibold text-atk">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="clip-x w-full bg-accent px-6 py-3 font-display text-sm font-bold tracking-wider text-bg transition enabled:hover:brightness-110 disabled:opacity-50"
      >
        {dict.auth.submitRegister}
      </button>
      <p className="text-center text-xs text-ink-dim">
        {dict.auth.haveAccount}{" "}
        <Link href={`/${locale}/login`} className="font-semibold text-accent hover:underline">
          {dict.auth.login}
        </Link>
      </p>
    </form>
  );
}
