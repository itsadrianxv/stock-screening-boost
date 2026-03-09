import type { ScreeningInsight } from "~/server/domain/intelligence/aggregates/screening-insight";
import { ResearchReminder } from "~/server/domain/intelligence/entities/research-reminder";
import type { IReminderRepository } from "~/server/domain/intelligence/repositories/reminder-repository";

export type ReminderSchedulingServiceDependencies = {
  reminderRepository: IReminderRepository;
};

export class ReminderSchedulingService {
  private readonly reminderRepository: IReminderRepository;

  constructor(dependencies: ReminderSchedulingServiceDependencies) {
    this.reminderRepository = dependencies.reminderRepository;
  }

  async scheduleReviewReminder(
    insight: ScreeningInsight,
  ): Promise<ResearchReminder> {
    const existingReminders = await this.reminderRepository.findByInsightId(
      insight.id,
    );
    const targetTime = insight.reviewPlan.nextReviewAt.getTime();

    for (const reminder of existingReminders) {
      if (reminder.reminderType !== "REVIEW") {
        continue;
      }

      if (reminder.scheduledAt.getTime() === targetTime) {
        if (reminder.status === "CANCELLED") {
          const restored = ResearchReminder.create({
            id: reminder.id,
            userId: reminder.userId,
            insightId: reminder.insightId,
            stockCode: reminder.stockCode,
            reminderType: reminder.reminderType,
            scheduledAt: reminder.scheduledAt,
            status: "PENDING",
            payload: reminder.payload,
            triggeredAt: null,
            createdAt: reminder.createdAt,
            updatedAt: new Date(),
          });
          await this.reminderRepository.save(restored);
          return restored;
        }

        return reminder;
      }

      if (reminder.status === "PENDING") {
        reminder.cancel();
        await this.reminderRepository.save(reminder);
      }
    }

    const reminder = ResearchReminder.create({
      userId: insight.userId,
      insightId: insight.id,
      stockCode: insight.stockCode,
      reminderType: "REVIEW",
      scheduledAt: insight.reviewPlan.nextReviewAt,
      payload: {
        summary: insight.summary,
        reviewReason: insight.reviewPlan.reviewReason,
        suggestedChecks: [...insight.reviewPlan.suggestedChecks],
        urgency: insight.reviewPlan.urgency,
      },
    });

    await this.reminderRepository.save(reminder);
    return reminder;
  }
}
