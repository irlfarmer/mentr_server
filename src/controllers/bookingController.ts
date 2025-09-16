import { Request, Response } from 'express';
import { Booking } from '../models/Booking';
import { Service } from '../models/Service';
import { User } from '../models/User';
import { AuthRequest } from '../types';
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';
import { addMinutes, startOfDay, endOfDay } from 'date-fns';
import { MentorEarningsService } from '../services/mentorEarningsService';
import { CommissionService } from '../services/commissionService';
import { bookingNotificationService } from '../services/bookingNotificationService';
import { payoutNotificationService } from '../services/payoutNotificationService';

// Create a new booking
export const createBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const { serviceId, scheduledAt, duration, notes, studentTimezone } = req.body;

    // Validate required fields
    if (!serviceId || !scheduledAt || !duration) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
      return;
    }

    // Get student timezone (default to UTC if not provided)
    const studentTz = studentTimezone || 'UTC';

    // Get the service to calculate amount and validate
    const service = await Service.findById(serviceId);
    if (!service) {
      res.status(404).json({
        success: false,
        error: 'Service not found'
      });
      return;
    }

    // Get mentor timezone
    const mentor = await User.findById(service.mentorId);
    if (!mentor) {
      res.status(404).json({
        success: false,
        error: 'Mentor not found'
      });
      return;
    }
    const mentorTz = (mentor as any).timezone || 'UTC';
    


    // Check if service is active
    if (!service.isActive) {
      res.status(400).json({
        success: false,
        error: 'Service is not available'
      });
      return;
    }

    // Check mentor availability
    const scheduledDate = new Date(scheduledAt);
    const dayOfWeek = scheduledDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    

    
    const mentorAvailability = mentor.availability?.find(slot => 
      slot.day === dayOfWeek && slot.isAvailable
    );



    if (!mentorAvailability || !mentorAvailability.startTime || !mentorAvailability.endTime) {

      res.status(400).json({
        success: false,
        error: 'Mentor is not available on this day'
      });
      return;
    }

    // Convert student's scheduled time to mentor's timezone for validation
    const studentScheduledTime = scheduledDate.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Convert student time to mentor timezone for comparison
    const studentTimeInMentorTz = toZonedTime(scheduledDate, mentorTz);
    const mentorTimeString = studentTimeInMentorTz.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Check if scheduled time is within mentor's available hours (in mentor's timezone)

    
    if (mentorTimeString < mentorAvailability.startTime || mentorTimeString >= mentorAvailability.endTime) {

      res.status(400).json({
        success: false,
        error: `Mentor is only available between ${mentorAvailability.startTime} and ${mentorAvailability.endTime} on ${dayOfWeek} in their timezone (${mentorTz})`
      });
      return;
    }

    // Convert scheduledAt from student timezone to UTC for storage
    const scheduledAtUTC = new Date(scheduledAt);
    
    // Calculate amount based on duration and hourly rate
    const hourlyRate = service.hourlyRate;
    const amount = (hourlyRate * duration) / 60; // Convert minutes to hours

    // Check for booking conflicts (using UTC times)
    const existingBooking = await Booking.findOne({
      mentorId: service.mentorId,
      scheduledAtUTC: {
        $gte: scheduledAtUTC,
        $lt: new Date(scheduledAtUTC.getTime() + duration * 60000)
      },
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existingBooking) {
      res.status(409).json({
        success: false,
        error: 'Time slot is already booked'
      });
      return;
    }

    const booking = new Booking({
      serviceId,
      mentorId: service.mentorId,
      studentId: userId,
      scheduledAt: new Date(scheduledAt), // Store original time for display
      scheduledAtUTC, // Store UTC time for calculations
      mentorTimezone: mentorTz,
      studentTimezone: studentTz,
      duration,
      amount,
      notes
    });

    await booking.save();

    // Send booking notifications
    try {
      await bookingNotificationService.sendNewBookingNotification({
        bookingId: (booking._id as any).toString(),
        menteeId: userId,
        mentorId: service.mentorId.toString(),
        serviceId: serviceId,
        bookingDate: new Date(scheduledAt),
        meetingLink: `${process.env.FRONTEND_URL}/video-call/${(booking._id as any).toString()}` // Generate meeting link
      });

      // Schedule reminder notifications using UTC time
      await bookingNotificationService.scheduleReminderNotifications({
        bookingId: (booking._id as any).toString(),
        menteeId: userId,
        mentorId: service.mentorId.toString(),
        serviceId: serviceId,
        bookingDate: scheduledAtUTC, // Use UTC time for accurate reminder calculations
        meetingLink: `https://meet.mentr.com/${(booking._id as any).toString()}`
      });
    } catch (notificationError) {
      console.error('Error sending booking notifications:', notificationError);
      // Don't fail the booking creation if notifications fail
    }

    // Populate service and user details for response
    await booking.populate([
      { path: 'serviceId', select: 'title description category' },
      { path: 'mentorId', select: 'firstName lastName profileImage' },
      { path: 'studentId', select: 'firstName lastName' }
    ]);

    res.status(201).json({
      success: true,
      data: booking,
      message: 'Booking created successfully'
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get bookings for a user (as mentor or student)
export const getBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const { role, status, page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    let query: any = {};
    
    // Filter by role (mentor or student)
    if (role === 'mentor') {
      query.mentorId = userId;
    } else if (role === 'student') {
      query.studentId = userId;
    } else {
      // If no role specified, get all bookings for the user
      query.$or = [{ mentorId: userId }, { studentId: userId }];
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate([
        { path: 'serviceId', select: 'title description category' },
        { path: 'mentorId', select: 'firstName lastName profileImage' },
        { path: 'studentId', select: 'firstName lastName' }
      ])
      .sort({ scheduledAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Booking.countDocuments(query);

    res.json({
      success: true,
      data: bookings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get a single booking by ID
export const getBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const booking = await Booking.findById(id)
      .populate([
        { path: 'serviceId', select: 'title description category hourlyRate' },
        { path: 'mentorId', select: 'firstName lastName profileImage email' },
        { path: 'studentId', select: 'firstName lastName email' }
      ]);

    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
      return;
    }

    // Check if user has access to this booking
    const mentorId = booking.mentorId._id ? booking.mentorId._id.toString() : booking.mentorId.toString();
    const studentId = booking.studentId._id ? booking.studentId._id.toString() : booking.studentId.toString();
    
    
    if (mentorId !== userId.toString() && studentId !== userId.toString()) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to view this booking'
      });
      return;
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update booking status (mentor can confirm/cancel, student can cancel)
export const updateBookingStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;
    const { status } = req.body;
    
    // Debug logging
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    if (!status || !['pending', 'confirmed', 'completed', 'cancelled', 'reviewable', 'reviewed'].includes(status)) {
      res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
      return;
    }

    const booking = await Booking.findById(id);

    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
      return;
    }

    // Check authorization
    const isMentor = booking.mentorId.toString() === userId.toString();
    const isStudent = booking.studentId.toString() === userId.toString();

    if (!isMentor && !isStudent) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to update this booking'
      });
      return;
    }

    // Validate status transitions
    if (status === 'confirmed' && !isMentor) {
      res.status(403).json({
        success: false,
        error: 'Only mentor can confirm bookings'
      });
      return;
    }

    if (status === 'completed' && !isMentor) {
      res.status(403).json({
        success: false,
        error: 'Only mentor can mark bookings as completed'
      });
      return;
    }

    // Update booking status
    
    booking.status = status;
    
    // Auto-transition completed bookings to reviewable for student reviews
    if (status === 'completed') {
      booking.status = 'reviewable';
      
      // CRITICAL: Calculate commission and add mentor earnings when booking is completed
      try {
        const mentor = await User.findById(booking.mentorId);
        if (mentor && booking.paymentStatus === 'paid') {
          // Calculate commission based on mentor's current tier
          const currentTier = CommissionService.calculateTier(mentor);
          const commissionAmount = CommissionService.calculateCommission(booking.amount, currentTier);
          const mentorPayout = CommissionService.calculateMentorPayout(booking.amount, currentTier);
          
          // Update booking with commission details
          booking.platformCommission = commissionAmount;
          booking.mentorPayout = mentorPayout;
          booking.commissionTier = currentTier;
          booking.payoutStatus = 'pending';
          booking.disputePeriodEnds = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now
          
          // Add earnings to mentor
          const earningsResult = await MentorEarningsService.addEarnings(
            booking.mentorId.toString(),
            {
              amount: booking.amount,
              type: 'session',
              description: `Session booking completed`,
               bookingId: (booking._id as any).toString()
            }
          );
          
          if (earningsResult.success) {
            console.log(`Mentor ${mentor.firstName} ${mentor.lastName} earned $${mentorPayout.toFixed(2)} from session (Commission: $${commissionAmount.toFixed(2)}, Tier: ${earningsResult.newTier || currentTier})`);
            
            // Send payout initiated notification
            try {
              await payoutNotificationService.sendPayoutInitiatedNotification({
                mentorId: booking.mentorId.toString(),
                payoutId: `initiated_${(booking._id as any).toString()}`,
                amount: mentorPayout,
                status: 'pending',
                payoutDate: new Date(),
                bookingIds: [(booking._id as any).toString()]
              });
            } catch (notificationError) {
              console.error('Error sending payout initiated notification:', notificationError);
              // Don't fail the booking completion if notification fails
            }
          }
        }
      } catch (error) {
        console.error('Error calculating commission for completed booking:', error);
        // Don't fail the booking completion if commission calculation fails
      }
    }
    
    // Ensure paymentStatus is not accidentally set to an invalid value
    if (!['pending', 'paid', 'refunded'].includes(booking.paymentStatus)) {
      booking.paymentStatus = 'paid'; // Default to 'paid' for confirmed/completed bookings
    }
    
    
    await booking.save();

    // Send notifications based on status change
    try {
      if (status === 'confirmed') {
        await bookingNotificationService.sendBookingConfirmationNotification({
          bookingId: (booking._id as any).toString(),
          menteeId: booking.studentId.toString(),
          mentorId: booking.mentorId.toString(),
          serviceId: booking.serviceId.toString(),
          bookingDate: booking.scheduledAt,
          meetingLink: `https://meet.mentr.com/${(booking._id as any).toString()}`
        });
      } else if (status === 'cancelled') {
        const cancelledBy = isMentor ? 'mentor' : 'mentee';
        await bookingNotificationService.sendBookingCancellationNotification({
          bookingId: (booking._id as any).toString(),
          menteeId: booking.studentId.toString(),
          mentorId: booking.mentorId.toString(),
          serviceId: booking.serviceId.toString(),
          bookingDate: booking.scheduledAt,
          meetingLink: `https://meet.mentr.com/${(booking._id as any).toString()}`,
          reason: req.body.reason || undefined
        }, cancelledBy);

        // Cancel scheduled reminders
        await bookingNotificationService.cancelScheduledReminders((booking._id as any).toString());
      }
    } catch (notificationError) {
      console.error('Error sending booking status notifications:', notificationError);
      // Don't fail the status update if notifications fail
    }

    // Populate details for response
    await booking.populate([
      { path: 'serviceId', select: 'title description category' },
      { path: 'mentorId', select: 'firstName lastName profileImage' },
      { path: 'studentId', select: 'firstName lastName' }
    ]);

    res.json({
      success: true,
      data: booking,
      message: 'Booking status updated successfully'
    });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update payment status
export const updatePaymentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;
    const { paymentStatus, stripePaymentIntentId } = req.body;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    if (!paymentStatus || !['pending', 'paid', 'refunded'].includes(paymentStatus)) {
      res.status(400).json({
        success: false,
        error: 'Invalid payment status'
      });
      return;
    }

    const booking = await Booking.findById(id);

    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
      return;
    }

    // Check authorization (mentor or student can update payment status)
    if (booking.mentorId.toString() !== userId.toString() && 
        booking.studentId.toString() !== userId.toString()) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to update this booking'
      });
      return;
    }

    // Update payment status
    booking.paymentStatus = paymentStatus;
    if (stripePaymentIntentId) {
      booking.stripePaymentIntentId = stripePaymentIntentId;
    }
    await booking.save();

    res.json({
      success: true,
      data: booking,
      message: 'Payment status updated successfully'
    });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get mentor availability for a specific date range
export const getMentorAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mentorId, startDate, endDate, timezone } = req.query;

    if (!mentorId || !startDate || !endDate) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
      return;
    }

    const userTimezone = (timezone as string) || 'UTC';
    
    // Convert dates to UTC for database query
    const startUTC = new Date(startDate as string);
    const endUTC = new Date(endDate as string);

    // Get all bookings for the mentor in the date range
    const bookings = await Booking.find({
      mentorId,
      scheduledAtUTC: { $gte: startUTC, $lte: endUTC },
      status: { $in: ['pending', 'confirmed'] }
    }).sort({ scheduledAtUTC: 1 });

    // Convert times back to user's timezone for response
    const bookingsWithLocalTime = bookings.map(booking => {
      const bookingObj = booking.toObject();
      (bookingObj as any).scheduledAtLocal = toZonedTime(booking.scheduledAtUTC, userTimezone);
      return bookingObj;
    });

    res.json({
      success: true,
      data: bookingsWithLocalTime
    });
  } catch (error) {
    console.error('Get mentor availability error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get available time slots for a specific date and mentor
export const getAvailableTimeSlots = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mentorId, date, timezone = 'UTC' } = req.query;

    if (!mentorId || !date) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameters: mentorId and date'
      });
      return;
    }

    // Get mentor availability
    const mentor = await User.findById(mentorId);
    if (!mentor || !mentor.availability) {
      res.status(404).json({
        success: false,
        error: 'Mentor not found or no availability set'
      });
      return;
    }

    // Parse the date
    const selectedDate = new Date(date as string);
    const dayOfWeek = format(selectedDate, 'EEEE').toLowerCase();
    
    // Find availability for this day
    const dayAvailability = mentor.availability.find((slot: any) => 
      slot.day === dayOfWeek && slot.isAvailable
    );

    if (!dayAvailability) {
      res.json({
        success: true,
        data: {
          availableSlots: [],
          message: 'No availability for this day'
        }
      });
      return;
    }

    // Get existing bookings for this date
    const startOfSelectedDay = startOfDay(selectedDate);
    const endOfSelectedDay = endOfDay(selectedDate);
    
    const existingBookings = await Booking.find({
      mentorId: mentorId,
      scheduledAt: {
        $gte: startOfSelectedDay,
        $lte: endOfSelectedDay
      },
      status: { $in: ['confirmed', 'pending'] }
    });

    // Generate time slots
    const availableSlots = [];
    const startTime = dayAvailability.startTime;
    const endTime = dayAvailability.endTime;
    
    // Convert time strings to minutes for easier calculation
    const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
    const endMinutes = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);
    
    // Generate 30-minute slots
    for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const timeString = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      
      // Check if this time slot conflicts with existing bookings
      const slotStartMinutes = minutes;
      const slotEndMinutes = minutes + 60; // Assuming 1-hour slots
      
      const hasConflict = existingBookings.some((booking: any) => {
        const bookingStartMinutes = booking.scheduledAt.getHours() * 60 + booking.scheduledAt.getMinutes();
        const bookingEndMinutes = bookingStartMinutes + booking.duration;
        
        // Check for overlap
        return (
          (slotStartMinutes >= bookingStartMinutes && slotStartMinutes < bookingEndMinutes) ||
          (slotEndMinutes > bookingStartMinutes && slotEndMinutes <= bookingEndMinutes) ||
          (slotStartMinutes <= bookingStartMinutes && slotEndMinutes >= bookingEndMinutes)
        );
      });
      
      if (!hasConflict) {
        availableSlots.push({
          time: timeString,
          endTime: `${Math.floor((minutes + 60) / 60).toString().padStart(2, '0')}:${((minutes + 60) % 60).toString().padStart(2, '0')}`,
          duration: 60
        });
      }
    }



    res.json({
      success: true,
      data: {
        availableSlots,
        mentorTimezone: mentor.timezone || 'UTC',
        dayAvailability: {
          startTime: dayAvailability.startTime,
          endTime: dayAvailability.endTime
        }
      }
    });

  } catch (error) {
    console.error('Error getting available time slots:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
