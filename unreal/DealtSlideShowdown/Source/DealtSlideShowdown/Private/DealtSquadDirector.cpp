#include "DealtSquadDirector.h"

#include "AIController.h"
#include "DealtEncounterSubsystem.h"
#include "DealtMemberPawn.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"

namespace DealtSquad
{
    FVector GridToWorld(const FDealtGridPoint& Point)
    {
        return FVector((Point.X - 3.5) * 320.0, (Point.Y - 3.5) * 320.0, 100.0);
    }
}

ADealtSquadDirector::ADealtSquadDirector()
{
    PrimaryActorTick.bCanEverTick = true;
}

void ADealtSquadDirector::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    DecisionAccumulator += FMath::Max(0.0f, DeltaSeconds);
    if (DecisionAccumulator < DecisionInterval) return;
    DecisionAccumulator = 0.0f;
    UpdatePresentationAi();
}

void ADealtSquadDirector::UpdatePresentationAi()
{
    UDealtEncounterSubsystem* Encounter = GetGameInstance()->GetSubsystem<UDealtEncounterSubsystem>();
    if (!Encounter || !Encounter->HasEncounter()) return;

    const FDealtEncounterPackage& Package = Encounter->GetEncounter();
    const FVector Extraction = DealtSquad::GridToWorld(Package.Extraction);

    for (const FDealtCombatant& Member : Package.Crew)
    {
        ADealtMemberPawn* Pawn = Encounter->FindMemberPawn(Member.Id);
        if (!Pawn || !Pawn->IsAvailableForPossession()) continue;
        if (Pawn->GetController() && Pawn->GetController()->IsPlayerController()) continue;
        if (!Pawn->GetController()) Pawn->SpawnDefaultController();
        if (AAIController* Ai = Cast<AAIController>(Pawn->GetController()))
        {
            Ai->MoveToLocation(Extraction, 135.0f, true, true, false, true);
        }
    }

    for (const FDealtCombatant& Rival : Package.Opposition)
    {
        ADealtMemberPawn* RivalPawn = Encounter->FindMemberPawn(Rival.Id);
        if (!RivalPawn || !RivalPawn->IsAvailableForPossession()) continue;
        if (!RivalPawn->GetController()) RivalPawn->SpawnDefaultController();

        ADealtMemberPawn* NearestCrew = nullptr;
        double NearestDistanceSquared = TNumericLimits<double>::Max();
        for (const FDealtCombatant& Member : Package.Crew)
        {
            ADealtMemberPawn* CrewPawn = Encounter->FindMemberPawn(Member.Id);
            if (!CrewPawn || !CrewPawn->IsAvailableForPossession()) continue;
            const double DistanceSquared = FVector::DistSquared(RivalPawn->GetActorLocation(), CrewPawn->GetActorLocation());
            if (DistanceSquared < NearestDistanceSquared)
            {
                NearestDistanceSquared = DistanceSquared;
                NearestCrew = CrewPawn;
            }
        }

        if (NearestCrew)
        {
            if (AAIController* Ai = Cast<AAIController>(RivalPawn->GetController()))
            {
                Ai->MoveToActor(NearestCrew, 550.0f, true, true, false, nullptr, true);
            }
        }
    }
}
