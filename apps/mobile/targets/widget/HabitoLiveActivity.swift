import ActivityKit
import WidgetKit
import SwiftUI

@main
struct HabitoWidgetBundle: WidgetBundle {
  var body: some Widget {
    HabitoWorkoutLiveActivity()
  }
}

struct HabitoWorkoutLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: HabitoWorkoutAttributes.self) { context in
      // Tarjeta de pantalla bloqueada / banner
      LockScreenView(context: context)
        .activityBackgroundTint(Color.black.opacity(0.92))
        .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Label {
            Text(context.attributes.workoutTitle)
              .font(.caption).fontWeight(.semibold)
              .lineLimit(1)
          } icon: {
            Image(systemName: "figure.strengthtraining.traditional")
              .foregroundStyle(.white)
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          TimerText(startedAt: context.attributes.startedAt)
            .font(.system(.title3, design: .rounded).monospacedDigit())
            .foregroundStyle(.white)
        }
        DynamicIslandExpandedRegion(.bottom) {
          ProgressFooter(completed: context.state.completed, total: context.state.total)
        }
      } compactLeading: {
        Image(systemName: "figure.strengthtraining.traditional")
          .foregroundStyle(.white)
      } compactTrailing: {
        TimerText(startedAt: context.attributes.startedAt)
          .monospacedDigit()
          .foregroundStyle(.white)
          .frame(maxWidth: 54)
      } minimal: {
        Image(systemName: "figure.strengthtraining.traditional")
          .foregroundStyle(.white)
      }
    }
  }
}

// MARK: - Subvistas

private struct LockScreenView: View {
  let context: ActivityViewContext<HabitoWorkoutAttributes>

  var body: some View {
    HStack(spacing: 14) {
      ZStack {
        Circle()
          .fill(.white.opacity(0.10))
          .frame(width: 44, height: 44)
        Image(systemName: "figure.strengthtraining.traditional")
          .font(.system(size: 20, weight: .medium))
          .foregroundStyle(.white)
      }
      VStack(alignment: .leading, spacing: 3) {
        Text(context.attributes.workoutTitle)
          .font(.headline)
          .foregroundStyle(.white)
          .lineLimit(1)
        ProgressFooter(completed: context.state.completed, total: context.state.total)
      }
      Spacer()
      VStack(alignment: .trailing, spacing: 2) {
        TimerText(startedAt: context.attributes.startedAt)
          .font(.system(.title2, design: .rounded).monospacedDigit())
          .foregroundStyle(.white)
        Text("EN CURSO")
          .font(.system(size: 9, weight: .semibold))
          .tracking(0.8)
          .foregroundStyle(.white.opacity(0.4))
      }
    }
    .padding(16)
  }
}

private struct ProgressFooter: View {
  let completed: Int
  let total: Int

  var body: some View {
    HStack(spacing: 5) {
      Image(systemName: "checkmark.circle")
        .font(.caption2)
        .foregroundStyle(.white.opacity(0.55))
      Text(total > 0 ? "\(completed)/\(total) ejercicios" : "\(completed) ejercicios")
        .font(.caption)
        .foregroundStyle(.white.opacity(0.6))
    }
  }
}

private struct TimerText: View {
  let startedAt: Double

  var body: some View {
    Text(Date(timeIntervalSince1970: startedAt), style: .timer)
  }
}
