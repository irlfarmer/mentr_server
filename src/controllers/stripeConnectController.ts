import { Request, Response } from 'express';
import { User } from '../models/User';
import { StripeService, ConnectAccountParams } from '../services/stripeService';
import { authenticate } from '../middleware/auth';

// Create Stripe Connect account for mentor
export const createConnectAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id;
    const { country, businessType } = req.body;

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Check if user already has a Connect account
    if (user.stripeConnect?.accountId) {
      res.status(400).json({ 
        success: false, 
        error: 'Stripe Connect account already exists' 
      });
      return;
    }

    // Create Connect account
    const connectParams: ConnectAccountParams = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      country: country || 'US',
      businessType: businessType || 'individual'
    };

    const connectResponse = await StripeService.createConnectAccount(connectParams);

    // Update user with Connect account details
    await User.findByIdAndUpdate(userId, {
      stripeConnect: {
        accountId: connectResponse.accountId,
        accountStatus: 'pending',
        onboardingComplete: false,
        payoutsEnabled: false,
        chargesEnabled: false,
        detailsSubmitted: false,
        lastUpdated: new Date()
      }
    });

    res.json({
      success: true,
      data: {
        accountId: connectResponse.accountId,
        onboardingUrl: connectResponse.accountLink
      }
    });
  } catch (error) {
    console.error('Error creating Connect account:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create Connect account' 
    });
  }
};

// Get Connect account status
export const getConnectAccountStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id;

    const user = await User.findById(userId).select('stripeConnect');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    if (!user.stripeConnect?.accountId) {
      res.json({
        success: true,
        data: {
          hasAccount: false,
          status: 'not_connected'
        }
      });
      return;
    }

    // Get fresh account details from Stripe
    const account = await StripeService.getConnectAccount(user.stripeConnect.accountId);
    const isReady = await StripeService.isAccountReady(user.stripeConnect.accountId);

    // Determine account status based on capabilities
    let accountStatus = 'pending';
    if (account.details_submitted && account.charges_enabled && account.payouts_enabled) {
      accountStatus = 'active';
    } else if (account.details_submitted && !account.charges_enabled && !account.payouts_enabled) {
      accountStatus = 'restricted';
    } else if (account.details_submitted) {
      accountStatus = 'pending_verification';
    }

    // Update user's Connect status
    await User.findByIdAndUpdate(userId, {
      'stripeConnect.accountStatus': accountStatus,
      'stripeConnect.onboardingComplete': account.details_submitted,
      'stripeConnect.payoutsEnabled': account.payouts_enabled,
      'stripeConnect.chargesEnabled': account.charges_enabled,
      'stripeConnect.detailsSubmitted': account.details_submitted,
      'stripeConnect.lastUpdated': new Date()
    });

    res.json({
      success: true,
      data: {
        hasAccount: true,
        accountId: user.stripeConnect.accountId,
        status: accountStatus,
        onboardingComplete: account.details_submitted,
        payoutsEnabled: account.payouts_enabled,
        chargesEnabled: account.charges_enabled,
        isReady
      }
    });
  } catch (error) {
    console.error('Error getting Connect account status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get Connect account status' 
    });
  }
};

// Create account link for onboarding or updates
export const createAccountLink = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id;
    const { type } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.stripeConnect?.accountId) {
      res.status(404).json({ 
        success: false, 
        error: 'Stripe Connect account not found' 
      });
      return;
    }

    // Check account status to determine appropriate link type
    const account = await StripeService.getConnectAccount(user.stripeConnect.accountId);
    const isOnboardingComplete = account.details_submitted && account.charges_enabled && account.payouts_enabled;
    
    // Determine the appropriate link type
    let linkType: 'account_onboarding' | 'account_update' = 'account_onboarding';
    if (type === 'account_update' && isOnboardingComplete) {
      linkType = 'account_update';
    } else if (type === 'account_update' && !isOnboardingComplete) {
      // If user requested account_update but account isn't ready, use onboarding
      linkType = 'account_onboarding';
    }

    const accountLink = await StripeService.createAccountLink(
      user.stripeConnect.accountId, 
      linkType
    );

    res.json({
      success: true,
      data: {
        accountLink,
        linkType,
        isOnboardingComplete
      }
    });
  } catch (error) {
    console.error('Error creating account link:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create account link' 
    });
  }
};

// Handle Stripe Connect webhook
export const handleConnectWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    const endpointSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET!;

    if (!signature) {
      res.status(400).json({
        success: false,
        error: 'Missing stripe signature'
      });
      return;
    }

    const event = StripeService.verifyWebhookSignature(
      JSON.stringify(req.body), 
      signature, 
      endpointSecret
    );

    switch (event.type) {
      case 'account.updated':
        const account = event.data.object;
        await User.findOneAndUpdate(
          { 'stripeConnect.accountId': account.id },
          {
            'stripeConnect.accountStatus': account.details_submitted ? 'active' : 'pending',
            'stripeConnect.onboardingComplete': account.details_submitted,
            'stripeConnect.payoutsEnabled': account.payouts_enabled,
            'stripeConnect.chargesEnabled': account.charges_enabled,
            'stripeConnect.detailsSubmitted': account.details_submitted,
            'stripeConnect.lastUpdated': new Date()
          }
        );
        break;

      case 'account.application.deauthorized':
        // Handle account deauthorization
        await User.findOneAndUpdate(
          { 'stripeConnect.accountId': event.data.object.id },
          {
            'stripeConnect.accountStatus': 'rejected',
            'stripeConnect.lastUpdated': new Date()
          }
        );
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error handling Connect webhook:', error);
    res.status(400).json({ 
      success: false, 
      error: 'Webhook signature verification failed' 
    });
  }
};
