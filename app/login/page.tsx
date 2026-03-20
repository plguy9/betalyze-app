import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const redirectParam = params.redirect;
  const redirectValue = Array.isArray(redirectParam) ? redirectParam[0] : redirectParam;
  const target = new URLSearchParams({ mode: "login" });
  if (typeof redirectValue === "string" && redirectValue.trim().length > 0) {
    target.set("redirect", redirectValue);
  }
  redirect(`/account?${target.toString()}`);
}
