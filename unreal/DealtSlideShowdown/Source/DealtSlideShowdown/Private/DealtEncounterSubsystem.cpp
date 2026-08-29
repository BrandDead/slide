#include "DealtEncounterSubsystem.h"

#include "Components/PrimitiveComponent.h"
#include "DealtContractCodec.h"
#include "DealtMemberPawn.h"
#include "GameFramework/Actor.h"
#include "Misc/Paths.h"

namespace DealtEncounter
{
    FDealtVector3 FromUnrealPosition(const FVector& Value)
    {
        FDealtVector3 Result;
        Result.X = Value.X / 100.0;
        Result.Y = Value.Z / 100.0;
        Result.Z = Value.Y / 100.0;
        return Result;
    }

    FDealtVector3 FromUnrealDirection(const FVector& Value)
    {
        const FVector Normalized = Value.GetSafeNormal();
        FDealtVector3 Result;
        Result.X = Normalized.X;
        Result.Y = Normalized.Z;
        Result.Z = Normalized.Y;
        return Result;
    }

    FString TaggedValue(const TArray<FName>& Tags, const FString& Prefix)
    {
        for (const FName& Tag : Tags)
        {
            const FString Value = Tag.ToString();
            if (Value.StartsWith(Prefix)) return Value.RightChop(Prefix.Len());
        }
        return FString();
    }

    EDealtHitZone HitZoneFromTagsOrBone(const TArray<FName>& Tags, const FName& BoneName)
    {
        if (Tags.Contains(TEXT("hit:head"))) return EDealtHitZone::Head;
        if (Tags.Contains(TEXT("hit:arm"))) return EDealtHitZone::Arm;
        if (Tags.Contains(TEXT("hit:leg"))) return EDealtHitZone::Leg;
        const FString Bone = BoneName.ToString().ToLower();
        if (Bone.Contains(TEXT("head")) || Bone.Contains(TEXT("neck"))) return EDealtHitZone::Head;
        if (Bone.Contains(TEXT("arm")) || Bone.Contains(TEXT("hand")) || Bone.Contains(TEXT("clavicle"))) return EDealtHitZone::Arm;
        if (Bone.Contains(TEXT("leg")) || Bone.Contains(TEXT("thigh")) || Bone.Contains(TEXT("calf")) || Bone.Contains(TEXT("foot"))) return EDealtHitZone::Leg;
        return EDealtHitZone::Torso;
    }
}

bool UDealtEncounterSubsystem::LoadCanonicalEncounter(FString& OutError)
{
    return LoadEncounterFile(FPaths::Combine(FPaths::ProjectContentDir(), TEXT("Contracts/encounter.1208.v1.json")), OutError);
}

bool UDealtEncounterSubsystem::LoadEncounterFile(const FString& FilePath, FString& OutError)
{
    FDealtEncounterPackage LoadedEncounter;
    if (!UDealtContractCodec::LoadEncounterFile(FilePath, LoadedEncounter, OutError)) return false;

    Encounter = MoveTemp(LoadedEncounter);
    bEncounterLoaded = true;
    bResultConsumed = false;
    PendingResultJson.Reset();
    MemberPawns.Reset();
    NextSequence = 1;

    const TArray<FString> LivingCrew = GetLivingCrewIds();
    SelectedMemberId = LivingCrew.IsEmpty() ? FString() : LivingCrew[0];
    SetCameraMode(EDealtCameraMode::ThirdPerson);
    OnEncounterLoaded.Broadcast(Encounter);
    OutError.Reset();
    return true;
}

void UDealtEncounterSubsystem::SetCameraMode(EDealtCameraMode NewMode)
{
    CameraMode = NewMode;
    ControlMode = CameraMode == EDealtCameraMode::Commander
        ? EDealtControlMode::Commander
        : EDealtControlMode::Possessed;
    OnPossessionChanged.Broadcast(ControlMode, SelectedMemberId);
}

TArray<FString> UDealtEncounterSubsystem::GetLivingCrewIds() const
{
    TArray<FString> Result;
    for (const FDealtCombatant& Member : Encounter.Crew)
    {
        if (!Member.bIsDown && Member.Health > 0) Result.Add(Member.Id);
    }
    return Result;
}

FString UDealtEncounterSubsystem::CycleSelectedMember(int32 Direction)
{
    const TArray<FString> LivingCrew = GetLivingCrewIds();
    if (LivingCrew.IsEmpty())
    {
        SelectedMemberId.Reset();
        OnPossessionChanged.Broadcast(ControlMode, SelectedMemberId);
        return SelectedMemberId;
    }

    const int32 CurrentIndex = FMath::Max(0, LivingCrew.IndexOfByKey(SelectedMemberId));
    const int32 Step = Direction >= 0 ? 1 : -1;
    const int32 NextIndex = (CurrentIndex + Step + LivingCrew.Num()) % LivingCrew.Num();
    SelectedMemberId = LivingCrew[NextIndex];
    OnPossessionChanged.Broadcast(ControlMode, SelectedMemberId);
    return SelectedMemberId;
}

void UDealtEncounterSubsystem::RegisterMemberPawn(const FString& MemberId, ADealtMemberPawn* Pawn)
{
    if (MemberId.IsEmpty() || !IsValid(Pawn)) return;
    MemberPawns.Add(MemberId, Pawn);
}

ADealtMemberPawn* UDealtEncounterSubsystem::FindMemberPawn(const FString& MemberId) const
{
    const TWeakObjectPtr<ADealtMemberPawn>* Found = MemberPawns.Find(MemberId);
    return Found ? Found->Get() : nullptr;
}

FDealtAimedFireCommand UDealtEncounterSubsystem::SubmitNativeHit(
    const FString& ActorId,
    const FVector& TraceOrigin,
    const FVector& TraceDirection,
    double MaxDistanceMeters,
    int32 ClientTick,
    const FHitResult& Hit)
{
    FDealtAimedFireCommand Command;
    Command.ActorId = ActorId;
    Command.Sequence = NextSequence++;
    Command.Ray.Origin = DealtEncounter::FromUnrealPosition(TraceOrigin);
    Command.Ray.Direction = DealtEncounter::FromUnrealDirection(TraceDirection);
    Command.Ray.MaxDistance = FMath::Clamp(MaxDistanceMeters, 1.0, 1000.0);
    Command.Ray.ClientTick = FMath::Max(0, ClientTick);

    const FVector ImpactPoint = Hit.bBlockingHit
        ? Hit.ImpactPoint
        : TraceOrigin + TraceDirection.GetSafeNormal() * Command.Ray.MaxDistance * 100.0;
    Command.Candidate.Point = DealtEncounter::FromUnrealPosition(ImpactPoint);
    Command.Candidate.Distance = FVector::Distance(TraceOrigin, ImpactPoint) / 100.0;
    Command.Candidate.Kind = EDealtImpactKind::Miss;

    const AActor* HitActor = Hit.GetActor();
    const UPrimitiveComponent* HitComponent = Hit.GetComponent();
    if (Hit.bBlockingHit && HitActor)
    {
        const FString ActorEntityId = DealtEncounter::TaggedValue(HitActor->Tags, TEXT("dealt.actor:"));
        const FString VehicleEntityId = DealtEncounter::TaggedValue(HitActor->Tags, TEXT("dealt.vehicle:"));
        const FString CoverEntityId = DealtEncounter::TaggedValue(HitActor->Tags, TEXT("dealt.cover:"));
        if (!ActorEntityId.IsEmpty())
        {
            Command.Candidate.Kind = EDealtImpactKind::Actor;
            Command.Candidate.EntityId = ActorEntityId;
            Command.Candidate.HitZone = HitComponent
                ? DealtEncounter::HitZoneFromTagsOrBone(HitComponent->ComponentTags, Hit.BoneName)
                : EDealtHitZone::Torso;
        }
        else if (!VehicleEntityId.IsEmpty())
        {
            Command.Candidate.Kind = EDealtImpactKind::Vehicle;
            Command.Candidate.EntityId = VehicleEntityId;
        }
        else if (!CoverEntityId.IsEmpty())
        {
            Command.Candidate.Kind = EDealtImpactKind::Cover;
            Command.Candidate.EntityId = CoverEntityId;
        }
        else
        {
            Command.Candidate.Kind = EDealtImpactKind::Environment;
            Command.Candidate.EntityId = HitActor->GetFName().ToString();
        }
    }

    OnAimedFireCommand.Broadcast(Command);
    return Command;
}

bool UDealtEncounterSubsystem::AcceptResultJson(const FString& ResultJson, FString& OutError)
{
    if (!bEncounterLoaded)
    {
        OutError = TEXT("No encounter is loaded.");
        return false;
    }
    if (!PendingResultJson.IsEmpty() || bResultConsumed)
    {
        OutError = TEXT("A result has already been accepted for this encounter.");
        return false;
    }

    FDealtEncounterResult ParsedResult;
    if (!UDealtContractCodec::ParseResultJson(ResultJson, ParsedResult, OutError)) return false;
    if (ParsedResult.EncounterId != Encounter.EncounterId)
    {
        OutError = TEXT("Result encounterId does not match the loaded encounter.");
        return false;
    }

    PendingResultJson = ResultJson;
    OnResultReady.Broadcast(PendingResultJson);
    OutError.Reset();
    return true;
}

bool UDealtEncounterSubsystem::ConsumePendingResultJson(FString& OutResultJson)
{
    if (PendingResultJson.IsEmpty() || bResultConsumed) return false;
    OutResultJson = PendingResultJson;
    bResultConsumed = true;
    PendingResultJson.Reset();
    return true;
}
