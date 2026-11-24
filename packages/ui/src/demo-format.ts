const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  currencyDisplay: "code",
});

const dateTime = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

export const formatMoney = (cents: number) => currency.format(cents / 100);
export const formatDate = (date: string) => dateTime.format(new Date(date));
