import CustomerLoginLoader from "@/components/auth/CustomerLoginLoader";
import { BOOKING_PAYMENT_PROGRESS } from "@/utils/bookingPayment";

const DEFAULT_PROGRESS_CONTENT = {
  [BOOKING_PAYMENT_PROGRESS.CREATING_BOOKING]: {
    eyebrow: "BOOKING SETUP",
    title: "Creating your booking",
    message: "Securing your service details before payment.",
  },
  [BOOKING_PAYMENT_PROGRESS.RECONCILING_PAYMENT]: {
    eyebrow: "PAYMENT CHECK",
    title: "Checking payment status",
    message: "Confirming the final gateway response so you are never charged twice.",
  },
  [BOOKING_PAYMENT_PROGRESS.VERIFYING_PAYMENT]: {
    eyebrow: "PAYMENT RECEIVED",
    title: "Verifying your payment",
    message: "Confirming payment and preparing the live garage search.",
  },
  [BOOKING_PAYMENT_PROGRESS.ACTIVATING_SEARCH]: {
    eyebrow: "GARAGE SEARCH",
    title: "Starting garage search",
    message: "Activating your booking for nearby eligible garages.",
  },
};

const getPreparingPaymentContent = (paymentMethod) => {
  if (paymentMethod === "wallet") {
    return {
      eyebrow: "ROVAUTO WALLET",
      title: "Paying with your wallet",
      message:
        "Applying your wallet balance securely and preparing the garage search.",
    };
  }

  if (paymentMethod === "split") {
    return {
      eyebrow: "SECURE CHECKOUT",
      title: "Preparing your payment",
      message:
        "Applying your wallet balance and preparing Cashfree for the remaining amount.",
    };
  }

  return {
    eyebrow: "SECURE CHECKOUT",
    title: "Preparing your payment",
    message: "Connecting to Cashfree and creating a protected payment session.",
  };
};

export default function BookingPaymentLoader({ phase, paymentMethod }) {
  const content =
    phase === BOOKING_PAYMENT_PROGRESS.PREPARING_PAYMENT
      ? getPreparingPaymentContent(paymentMethod)
      : DEFAULT_PROGRESS_CONTENT[phase];

  return (
    <CustomerLoginLoader
      visible={Boolean(content)}
      eyebrow={content?.eyebrow}
      title={content?.title}
      message={content?.message}
    />
  );
}
