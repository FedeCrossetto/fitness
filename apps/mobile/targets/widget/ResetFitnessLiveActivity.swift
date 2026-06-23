import ActivityKit
import WidgetKit
import SwiftUI

@main
struct ResetFitnessWidgetBundle: WidgetBundle {
  var body: some Widget {
    ResetFitnessWorkoutLiveActivity()
  }
}

struct ResetFitnessWorkoutLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: ResetFitnessWorkoutAttributes.self) { context in
      LockScreenView(context: context)
        .activityBackgroundTint(Color.black.opacity(0.96))
        .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          VStack(alignment: .leading, spacing: 2) {
            Text("Entrenamiento")
              .font(.caption2)
              .foregroundStyle(.white.opacity(0.55))
            Text(context.state.exerciseName)
              .font(.caption)
              .fontWeight(.semibold)
              .lineLimit(1)
              .foregroundStyle(.white)
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          ElapsedMinutesText(startedAt: context.attributes.startedAt)
            .font(.system(.body, design: .rounded).monospacedDigit())
            .foregroundStyle(.white)
        }
        DynamicIslandExpandedRegion(.bottom) {
          HStack {
            SetPrescriptionText(state: context.state)
              .font(.subheadline.weight(.semibold))
              .foregroundStyle(.white)
            Spacer()
            if context.state.exerciseSetCount > 0 {
              Text("Serie \(context.state.currentSet) de \(context.state.exerciseSetCount)")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.55))
            }
          }
        }
      } compactLeading: {
        Image(systemName: "figure.strengthtraining.traditional")
          .foregroundStyle(.white)
      } compactTrailing: {
        ElapsedMinutesText(startedAt: context.attributes.startedAt)
          .monospacedDigit()
          .foregroundStyle(.white)
          .frame(maxWidth: 44)
      } minimal: {
        Image(systemName: "figure.strengthtraining.traditional")
          .foregroundStyle(.white)
      }
    }
  }
}

// MARK: - Lock screen (estilo Hevy)

private struct LockScreenView: View {
  let context: ActivityViewContext<ResetFitnessWorkoutAttributes>

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      HStack(alignment: .center) {
        HStack(spacing: 6) {
          BrandMark()
          Text("Entrenamiento")
            .font(.subheadline)
            .foregroundStyle(.white.opacity(0.55))
        }
        Spacer()
        ElapsedMinutesText(startedAt: context.attributes.startedAt)
          .font(.subheadline.weight(.semibold))
          .monospacedDigit()
          .foregroundStyle(.white)
      }

      HStack(spacing: 12) {
        ExerciseThumbnail()
        VStack(alignment: .leading, spacing: 3) {
          Text(context.state.exerciseName)
            .font(.headline)
            .foregroundStyle(.white)
            .lineLimit(2)
          if context.state.exerciseSetCount > 0 {
            Text("Serie \(context.state.currentSet) de \(context.state.exerciseSetCount)")
              .font(.subheadline)
              .foregroundStyle(.white.opacity(0.55))
          }
        }
        Spacer(minLength: 0)
      }

      HStack(alignment: .center) {
        SetPrescriptionText(state: context.state)
          .font(.system(size: 26, weight: .bold))
          .foregroundStyle(.white)
          .lineLimit(1)
          .minimumScaleFactor(0.75)
        Spacer()
        CheckmarkPlaceholder()
      }
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 14)
  }
}

private struct BrandMark: View {
  var body: some View {
    Image("AppLogo")
      .resizable()
      .scaledToFit()
      .frame(width: 24, height: 24)
      .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
  }
}

private struct ExerciseThumbnail: View {
  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(.white.opacity(0.10))
        .frame(width: 48, height: 48)
      Image(systemName: "figure.strengthtraining.traditional")
        .font(.system(size: 22, weight: .medium))
        .foregroundStyle(.white.opacity(0.85))
    }
  }
}

private struct CheckmarkPlaceholder: View {
  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(.white.opacity(0.14))
        .frame(width: 48, height: 48)
      Image(systemName: "checkmark")
        .font(.system(size: 20, weight: .semibold))
        .foregroundStyle(.white.opacity(0.75))
    }
  }
}

private struct SetPrescriptionText: View {
  let state: ResetFitnessWorkoutAttributes.ContentState

  var body: some View {
    Text(formatSetPrescription(state))
  }
}

private func formatSetPrescription(_ state: ResetFitnessWorkoutAttributes.ContentState) -> String {
  let weight = state.weightKg
  let reps = state.reps

  if let weight, let reps {
    let weightText = weight.truncatingRemainder(dividingBy: 1) == 0
      ? String(format: "%.0f", weight)
      : String(format: "%.1f", weight)
    return "\(weightText) kg x \(reps) reps"
  }
  if let weight {
    let weightText = weight.truncatingRemainder(dividingBy: 1) == 0
      ? String(format: "%.0f", weight)
      : String(format: "%.1f", weight)
    return "\(weightText) kg"
  }
  if let reps {
    return "\(reps) reps"
  }
  return "—"
}

private struct ElapsedMinutesText: View {
  let startedAt: Double

  var body: some View {
    TimelineView(.periodic(from: Date(), by: 30)) { timeline in
      Text(formatElapsedMinutes(startedAt: startedAt, now: timeline.date))
    }
  }
}

private func formatElapsedMinutes(startedAt: Double, now: Date) -> String {
  let elapsed = max(0, now.timeIntervalSince1970 - startedAt)
  let minutes = Int(elapsed / 60)
  if minutes < 1 { return "< 1 min" }
  return "\(minutes) min"
}
