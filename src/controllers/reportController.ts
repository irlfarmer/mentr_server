import { Request, Response } from 'express';
import { Report } from '../models/Report';
import { AuthRequest } from '../types';

// Create a new report
export const createReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const { reportedId, reportedModel, reason, description } = req.body;

    // Validate required fields
    if (!reportedId || !reportedModel || !reason || !description) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
      return;
    }

    // Validate reportedModel
    if (!['User', 'Service'].includes(reportedModel)) {
      res.status(400).json({
        success: false,
        error: 'Invalid reportedModel. Must be User or Service'
      });
      return;
    }

    // Validate reason
    const validReasons = [
      'inappropriate_content',
      'spam',
      'harassment',
      'false_information',
      'scam',
      'other'
    ];
    if (!validReasons.includes(reason)) {
      res.status(400).json({
        success: false,
        error: 'Invalid reason'
      });
      return;
    }

    // Prevent self-reporting (for profiles)
    if (reportedModel === 'User' && reportedId === userId.toString()) {
      res.status(400).json({
        success: false,
        error: 'Cannot report yourself'
      });
      return;
    }

    // Create report
    const report = new Report({
      reporterId: userId,
      reportedId,
      reportedModel,
      reason,
      description: description.trim().substring(0, 1000) // Enforce max length
    });

    await report.save();

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      data: report
    });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create report'
    });
  }
};

// Get all reports (Admin only)
export const getReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    
    const query: any = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (type && type !== 'all') {
      query.reportedModel = type === 'profile' ? 'User' : 'Service';
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [reports, total] = await Promise.all([
      Report.find(query)
        .populate('reporterId', 'firstName lastName email profileImage')
        .populate({
          path: 'reportedId',
          select: 'firstName lastName email profileImage title description'
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Report.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        reports,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports'
    });
  }
};

// Update report status (Admin only)
export const updateReportStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!['pending', 'resolved', 'dismissed'].includes(status)) {
      res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
      return;
    }

    const report = await Report.findByIdAndUpdate(
      id,
      { 
        status,
        ...(adminNotes && { adminNotes })
      },
      { new: true }
    )
      .populate('reporterId', 'firstName lastName email')
      .populate({
        path: 'reportedId',
        select: 'firstName lastName email title description'
      });

    if (!report) {
      res.status(404).json({
        success: false,
        error: 'Report not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Report updated successfully',
      data: report
    });
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update report'
    });
  }
};

// Get report statistics (Admin only)
export const getReportStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const [totalReports, pendingReports, resolvedReports, dismissedReports] = await Promise.all([
      Report.countDocuments(),
      Report.countDocuments({ status: 'pending' }),
      Report.countDocuments({ status: 'resolved' }),
      Report.countDocuments({ status: 'dismissed' })
    ]);

    res.json({
      success: true,
      data: {
        total: totalReports,
        pending: pendingReports,
        resolved: resolvedReports,
        dismissed: dismissedReports
      }
    });
  } catch (error) {
    console.error('Get report stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch report statistics'
    });
  }
};
