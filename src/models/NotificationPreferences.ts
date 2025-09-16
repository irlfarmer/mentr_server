import mongoose, { Document, Schema } from 'mongoose';

export interface INotificationPreferences extends Document {
  userId: mongoose.Types.ObjectId;
  email: {
    enabled: boolean;
    booking: boolean;
    reschedule: boolean;
    chat: boolean;
    payout: boolean;
    dispute: boolean;
    system: boolean;
    verification: boolean;
  };
  push: {
    enabled: boolean;
    booking: boolean;
    reschedule: boolean;
    chat: boolean;
    payout: boolean;
    dispute: boolean;
    system: boolean;
  };
  inApp: {
    enabled: boolean;
    booking: boolean;
    reschedule: boolean;
    chat: boolean;
    payout: boolean;
    dispute: boolean;
    system: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string; // HH:MM format
    timezone: string;
  };
  frequency: {
    immediate: boolean; // Send immediately
    daily: boolean; // Daily digest
    weekly: boolean; // Weekly digest
  };
  createdAt: Date;
  updatedAt: Date;
}

const NotificationPreferencesSchema = new Schema<INotificationPreferences>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  email: {
    enabled: {
      type: Boolean,
      default: true
    },
    booking: {
      type: Boolean,
      default: true
    },
    reschedule: {
      type: Boolean,
      default: true
    },
    chat: {
      type: Boolean,
      default: true
    },
    payout: {
      type: Boolean,
      default: true
    },
    dispute: {
      type: Boolean,
      default: true
    },
    system: {
      type: Boolean,
      default: true
    },
    verification: {
      type: Boolean,
      default: true
    }
  },
  push: {
    enabled: {
      type: Boolean,
      default: true
    },
    booking: {
      type: Boolean,
      default: true
    },
    reschedule: {
      type: Boolean,
      default: true
    },
    chat: {
      type: Boolean,
      default: true
    },
    payout: {
      type: Boolean,
      default: true
    },
    dispute: {
      type: Boolean,
      default: true
    },
    system: {
      type: Boolean,
      default: true
    }
  },
  inApp: {
    enabled: {
      type: Boolean,
      default: true
    },
    booking: {
      type: Boolean,
      default: true
    },
    reschedule: {
      type: Boolean,
      default: true
    },
    chat: {
      type: Boolean,
      default: true
    },
    payout: {
      type: Boolean,
      default: true
    },
    dispute: {
      type: Boolean,
      default: true
    },
    system: {
      type: Boolean,
      default: true
    }
  },
  quietHours: {
    enabled: {
      type: Boolean,
      default: false
    },
    start: {
      type: String,
      default: '22:00',
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    end: {
      type: String,
      default: '08:00',
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  frequency: {
    immediate: {
      type: Boolean,
      default: true
    },
    daily: {
      type: Boolean,
      default: false
    },
    weekly: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

export const NotificationPreferences = mongoose.model<INotificationPreferences>('NotificationPreferences', NotificationPreferencesSchema);
