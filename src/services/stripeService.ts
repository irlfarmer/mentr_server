import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export interface CreatePaymentIntentParams {
  amount: number; // Amount in cents
  currency: string;
  bookingId: string;
  customerEmail: string;
  description: string;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

export interface ConnectAccountParams {
  email: string;
  firstName: string;
  lastName: string;
  country: string;
  businessType: 'individual' | 'company';
}

export interface ConnectAccountResponse {
  accountId: string;
  accountLink: string;
}

export interface TransferParams {
  amount: number; // Amount in cents
  currency: string;
  destination: string; // Connected account ID
  description: string;
  metadata?: Record<string, string>;
}

export class StripeService {
  // Create a payment intent
  static async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResponse> {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: params.amount, // Amount is already in cents from the controller
        currency: params.currency,
        metadata: {
          bookingId: params.bookingId,
          customerEmail: params.customerEmail,
        },
        description: params.description,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      throw new Error('Failed to create payment intent');
    }
  }

  // Retrieve a payment intent
  static async getPaymentIntent(paymentIntentId: string) {
    try {
      return await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      throw new Error('Failed to retrieve payment intent');
    }
  }

  // Create a customer
  static async createCustomer(email: string, name?: string) {
    try {
      return await stripe.customers.create({
        email,
        name,
      });
    } catch (error) {
      throw new Error('Failed to create customer');
    }
  }

  // Create a refund
  static async createRefund(paymentIntentId: string, amount?: number) {
    try {
      const refundParams: any = {
        payment_intent: paymentIntentId,
      };

      if (amount) {
        refundParams.amount = Math.round(amount * 100); // Convert to cents
      }

      return await stripe.refunds.create(refundParams);
    } catch (error) {
      throw new Error('Failed to create refund');
    }
  }

  // Verify webhook signature
  static verifyWebhookSignature(payload: string, signature: string, endpointSecret: string) {
    try {
      console.log('Verifying webhook signature...');
      console.log('Payload length:', payload.length);
      console.log('Signature:', signature);
      console.log('Endpoint secret present:', !!endpointSecret);
      
      const event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
      console.log('Webhook signature verification successful');
      return event;
    } catch (error: any) {
      console.error('Webhook signature verification error:', error.message);
      console.error('Error type:', error.type);
      throw new Error('Invalid webhook signature');
    }
  }

  // Create a Stripe Connect account for mentors
  static async createConnectAccount(params: ConnectAccountParams): Promise<ConnectAccountResponse> {
    try {
      const account = await stripe.accounts.create({
        type: 'express',
        country: params.country,
        email: params.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: params.businessType,
        individual: {
          first_name: params.firstName,
          last_name: params.lastName,
          email: params.email,
        },
      });

      // Create account link for onboarding
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${process.env.CLIENT_URL}/mentor/connect/refresh`,
        return_url: `${process.env.CLIENT_URL}/mentor/connect/success`,
        type: 'account_onboarding',
      });

      return {
        accountId: account.id,
        accountLink: accountLink.url,
      };
    } catch (error) {
      throw new Error('Failed to create Connect account');
    }
  }

  // Get Connect account details
  static async getConnectAccount(accountId: string) {
    try {
      return await stripe.accounts.retrieve(accountId);
    } catch (error) {
      throw new Error('Failed to retrieve Connect account');
    }
  }

  // Create account link for existing accounts
  static async createAccountLink(accountId: string, type: 'account_onboarding' | 'account_update' = 'account_onboarding') {
    try {
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${process.env.CLIENT_URL}/mentor/connect/refresh`,
        return_url: `${process.env.CLIENT_URL}/mentor/connect/success`,
        type,
      });

      return accountLink.url;
    } catch (error) {
      throw new Error('Failed to create account link');
    }
  }

  // Transfer funds to connected account
  static async transferToAccount(params: TransferParams) {
    try {
      const transfer = await stripe.transfers.create({
        amount: params.amount,
        currency: params.currency,
        destination: params.destination,
        description: params.description,
        metadata: params.metadata || {},
      });

      return transfer;
    } catch (error) {
      throw new Error('Failed to transfer funds');
    }
  }

  // Get transfer details
  static async getTransfer(transferId: string) {
    try {
      return await stripe.transfers.retrieve(transferId);
    } catch (error) {
      throw new Error('Failed to retrieve transfer');
    }
  }

  // Check if account is ready for payouts
  static async isAccountReady(accountId: string): Promise<boolean> {
    try {
      const account = await stripe.accounts.retrieve(accountId);
      return account.details_submitted && account.charges_enabled && account.payouts_enabled;
    } catch (error) {
      return false;
    }
  }
}
