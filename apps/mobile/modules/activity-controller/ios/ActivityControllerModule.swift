import ActivityKit
import Foundation
import ExpoModulesCore

// MARK: - Excepciones

final class ActivityUnavailableException: GenericException<Void> {
  override var reason: String {
    "Las Live Activities no están disponibles o están desactivadas en este dispositivo."
  }
}

final class ActivityFailedToStartException: GenericException<Void> {
  override var reason: String {
    "No se pudo iniciar la Live Activity."
  }
}

final class ActivityDataException: GenericException<String> {
  override var reason: String {
    "Los datos enviados a la Live Activity son inválidos: \(param)"
  }
}

// MARK: - Args (JSON desde JS)

private struct LiveActivityPayload: Codable {
  let completed: Int
  let total: Int
  let exerciseName: String
  let currentSet: Int
  let exerciseSetCount: Int
  let weightKg: Double?
  let reps: Int?

  func asContentState() -> ResetFitnessWorkoutAttributes.ContentState {
    ResetFitnessWorkoutAttributes.ContentState(
      completed: completed,
      total: total,
      exerciseName: exerciseName,
      currentSet: currentSet,
      exerciseSetCount: exerciseSetCount,
      weightKg: weightKg,
      reps: reps
    )
  }

  static func fromJSON(_ raw: String) -> Self? {
    try? JSONDecoder().decode(Self.self, from: Data(raw.utf8))
  }
}

private struct StartArgs: Codable {
  let workoutTitle: String
  let startedAt: Double
  let completed: Int
  let total: Int
  let exerciseName: String
  let currentSet: Int
  let exerciseSetCount: Int
  let weightKg: Double?
  let reps: Int?

  static func fromJSON(_ raw: String) -> Self? {
    try? JSONDecoder().decode(Self.self, from: Data(raw.utf8))
  }

  var payload: LiveActivityPayload {
    LiveActivityPayload(
      completed: completed,
      total: total,
      exerciseName: exerciseName,
      currentSet: currentSet,
      exerciseSetCount: exerciseSetCount,
      weightKg: weightKg,
      reps: reps
    )
  }
}

// MARK: - Módulo

public class ActivityControllerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ActivityController")

    Property("areLiveActivitiesEnabled") { () -> Bool in
      ActivityAuthorizationInfo().areActivitiesEnabled
    }

    Function("isActivityRunning") { () -> Bool in
      !Activity<ResetFitnessWorkoutAttributes>.activities.isEmpty
    }

    AsyncFunction("startLiveActivity") { (rawData: String, promise: Promise) in
      guard let args = StartArgs.fromJSON(rawData) else {
        throw ActivityDataException(rawData)
      }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else {
        throw ActivityUnavailableException(())
      }

      let state = args.payload.asContentState()

      if let existing = Activity<ResetFitnessWorkoutAttributes>.activities.first {
        Task {
          await existing.update(ActivityContent(state: state, staleDate: nil))
          promise.resolve(existing.id)
        }
        return
      }

      let attributes = ResetFitnessWorkoutAttributes(
        workoutTitle: args.workoutTitle,
        startedAt: args.startedAt
      )
      do {
        let activity = try Activity.request(
          attributes: attributes,
          content: ActivityContent(state: state, staleDate: nil)
        )
        promise.resolve(activity.id)
      } catch {
        throw ActivityFailedToStartException(())
      }
    }

    AsyncFunction("updateLiveActivity") { (rawData: String, promise: Promise) in
      guard let args = LiveActivityPayload.fromJSON(rawData) else {
        throw ActivityDataException(rawData)
      }
      guard let activity = Activity<ResetFitnessWorkoutAttributes>.activities.first else {
        promise.resolve()
        return
      }
      let state = args.asContentState()
      Task {
        await activity.update(ActivityContent(state: state, staleDate: nil))
        promise.resolve()
      }
    }

    AsyncFunction("stopLiveActivity") { (promise: Promise) in
      let activities = Activity<ResetFitnessWorkoutAttributes>.activities
      guard !activities.isEmpty else {
        promise.resolve()
        return
      }
      Task {
        for activity in activities {
          await activity.end(
            ActivityContent(state: activity.content.state, staleDate: nil),
            dismissalPolicy: .immediate
          )
        }
        promise.resolve()
      }
    }
  }
}
