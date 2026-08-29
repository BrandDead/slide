#include "DealtCommanderPawn.h"

#include "Camera/CameraComponent.h"
#include "Components/SceneComponent.h"
#include "GameFramework/SpringArmComponent.h"

ADealtCommanderPawn::ADealtCommanderPawn()
{
    PrimaryActorTick.bCanEverTick = false;

    SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("SceneRoot"));
    SetRootComponent(SceneRoot);

    CameraArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraArm"));
    CameraArm->SetupAttachment(SceneRoot);
    CameraArm->TargetArmLength = 1150.0f;
    CameraArm->SetRelativeRotation(FRotator(-58.0f, -35.0f, 0.0f));
    CameraArm->bDoCollisionTest = false;
    CameraArm->bEnableCameraLag = true;
    CameraArm->CameraLagSpeed = 8.0f;

    Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
    Camera->SetupAttachment(CameraArm, USpringArmComponent::SocketName);
    Camera->FieldOfView = 58.0f;
}

void ADealtCommanderPawn::PanCommander(const FVector2D& Input, float DeltaSeconds)
{
    const FRotator YawOnly(0.0f, CameraArm->GetComponentRotation().Yaw, 0.0f);
    const FVector Forward = FRotationMatrix(YawOnly).GetUnitAxis(EAxis::X);
    const FVector Right = FRotationMatrix(YawOnly).GetUnitAxis(EAxis::Y);
    const FVector Delta = (Forward * Input.Y + Right * Input.X) * PanSpeed * FMath::Max(0.0f, DeltaSeconds);
    AddActorWorldOffset(Delta, true);
}

void ADealtCommanderPawn::ZoomCommander(float Input)
{
    CameraArm->TargetArmLength = FMath::Clamp(
        CameraArm->TargetArmLength - Input * 120.0f,
        MinimumArmLength,
        MaximumArmLength);
}
