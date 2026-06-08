#!/usr/bin/env bash
# fill.sh — интерактивное заполнение плейсхолдеров в legal/*.kz.md
set -euo pipefail

cd "$(dirname "$0")"

if ! ls *.kz.md >/dev/null 2>&1; then
  echo "Нет файлов *.kz.md в текущей папке." >&2
  exit 1
fi

echo "=== Заполнение юр. документов AziralPDF ==="
echo "Все значения можно потом поменять — это просто прогон по плейсхолдерам."
echo

read -rp "ФИО индивидуального предпринимателя (как в свидетельстве): " FIO
read -rp "ИИН (12 цифр): " IIN
read -rp "Полный адрес регистрации (напр. г. Астана, район Есиль, ул. Туран, д. 1, кв. 1): " ADDRESS
read -rp "E-mail для юр. уведомлений (legal@aziral.com): " EMAIL_LEGAL
EMAIL_LEGAL=${EMAIL_LEGAL:-legal@aziral.com}
read -rp "E-mail поддержки (support@aziral.com): " EMAIL_SUPPORT
EMAIL_SUPPORT=${EMAIL_SUPPORT:-support@aziral.com}
read -rp "E-mail по ПДн (privacy@aziral.com): " EMAIL_PRIVACY
EMAIL_PRIVACY=${EMAIL_PRIVACY:-privacy@aziral.com}
read -rp "Дата вступления в силу (напр. 01 июля 2026 г.): " EFFDATE
read -rp "Платёжный провайдер [Kaspi Pay / CloudPayments Kazakhstan / PayBox.kz / Halyk Acquiring]: " PAYPROV
PAYPROV=${PAYPROV:-Kaspi Pay}
read -rp "Хостинг-провайдер (напр. PS Internet Company (ps.kz), Selectel, Hetzner): " HOSTPROV
HOSTPROV=${HOSTPROV:-PS Internet Company (ps.kz)}
read -rp "Страна размещения серверов [Республика Казахстан]: " DCCOUNTRY
DCCOUNTRY=${DCCOUNTRY:-Республика Казахстан}
read -rp "Минимальный возраст пользователя [18]: " MINAGE
MINAGE=${MINAGE:-18}

OUT=filled
mkdir -p "$OUT"
cp *.kz.md "$OUT/"
cd "$OUT"

# Замены
declare -A REPL=(
  [OPERATOR_FIO]="$FIO"
  [OPERATOR_IIN]="$IIN"
  [OPERATOR_ADDRESS]="$ADDRESS"
  [OPERATOR_EMAIL]="$EMAIL_LEGAL"
  [OPERATOR_SUPPORT_EMAIL]="$EMAIL_SUPPORT"
  [OPERATOR_PRIVACY_EMAIL]="$EMAIL_PRIVACY"
  [EFFECTIVE_DATE]="$EFFDATE"
  [PAYMENT_PROVIDER]="$PAYPROV"
  [HOSTING_PROVIDER]="$HOSTPROV"
  [DATA_RESIDENCY_COUNTRY]="$DCCOUNTRY"
  [MIN_AGE]="$MINAGE"
  [ANALYTICS_NOTE]=""
)

for key in "${!REPL[@]}"; do
  val="${REPL[$key]}"
  # экранируем разделитель sed (|) и обратный слеш
  val_escaped=$(printf '%s' "$val" | sed 's/[|&\\]/\\&/g')
  sed -i "s|{{$key}}|$val_escaped|g" *.md
done

# Удалим оставшиеся неиспользованные плейсхолдеры (если есть)
LEFT=$(grep -h '{{' *.md 2>/dev/null | head -5 || true)
if [ -n "$LEFT" ]; then
  echo
  echo "ВНИМАНИЕ: остались незаполненные плейсхолдеры:"
  echo "$LEFT"
fi

echo
echo "Готово. Заполненные документы — в папке: legal/$OUT/"
ls -la
